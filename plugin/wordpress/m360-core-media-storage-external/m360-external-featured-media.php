<?php
/**
 * Plugin Name: M360 - Core Media Storage External
 * Description: Registers virtual attachments for externally stored M360 featured images.
 * Author: M360
 * Version: 0.1.9
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/class-m360-storage-provider-registry.php';

final class M360_External_Featured_Media_Pilot
{
    /**
     * Single delivery profile for the MVP. Source assets remain in Cloudinary;
     * no WordPress thumbnails are created for virtual attachments.
     */
    private const MVP_DISPLAY_WIDTH = 768;
    private const META_MARKER = '_m360_external_featured_media';
    private const META_SHA256 = '_m360_external_media_sha256';
    private const META_ASSET_ID = '_m360_external_cloudinary_asset_id';
    private const META_PUBLIC_ID = '_m360_external_cloudinary_public_id';
    private const META_URL = '_m360_external_cloudinary_secure_url';
    private const META_WIDTH = '_m360_external_media_width';
    private const META_HEIGHT = '_m360_external_media_height';
    private const META_ALT = '_m360_external_featured_alt';
    private const META_TITLE = '_m360_external_featured_title';
    private const META_DESCRIPTION = '_m360_external_featured_description';
    private const META_CAPTION = '_m360_external_featured_caption';
    private const META_NATIVE_EDITORIAL_OWNER = '_m360_external_native_editorial_owner_post_id';
    private const META_STORAGE_PROVIDER = '_m360_external_storage_provider';
    private const META_STORAGE_ASSET_ID = '_m360_external_storage_asset_id';
    private const META_STORAGE_PUBLIC_ID = '_m360_external_storage_public_id';
    private const META_STORAGE_URL = '_m360_external_storage_url';

    public static function register(): void
    {
        M360_Storage_Provider_Registry::register();
        add_action('rest_api_init', [self::class, 'register_routes']);
        add_filter('wp_get_attachment_url', [self::class, 'filter_attachment_url'], 10, 2);
        add_filter('image_downsize', [self::class, 'filter_image_downsize'], 10, 3);
        add_filter('wp_get_attachment_image_attributes', [self::class, 'filter_image_attributes'], 10, 3);
        add_filter('wp_get_attachment_caption', [self::class, 'filter_attachment_caption'], 10, 2);
        add_filter('wpseo_add_opengraph_images', [self::class, 'add_yoast_opengraph_image'], 5);
        add_filter('wpseo_twitter_image', [self::class, 'filter_yoast_twitter_image'], 10, 1);
    }

    public static function register_routes(): void
    {
        register_rest_route('m360/v1', '/external-featured-media', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'register_media'],
            'permission_callback' => static fn (): bool => current_user_can('upload_files'),
        ]);

        register_rest_route('m360/v1', '/external-featured-media/assign', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [self::class, 'assign_to_post'],
            'permission_callback' => static fn (): bool => current_user_can('edit_posts'),
        ]);
    }

    public static function register_media(WP_REST_Request $request)
    {
        $provider = self::normalize_provider((string) $request->get_param('provider'));
        $sha256 = strtolower((string) $request->get_param('sha256'));
        $asset_id = sanitize_text_field((string) $request->get_param('asset_id'));
        $public_id = sanitize_text_field((string) $request->get_param('public_id'));
        $secure_url = esc_url_raw((string) $request->get_param('secure_url'));
        $width = absint($request->get_param('width'));
        $height = absint($request->get_param('height'));
        $mime_type = sanitize_mime_type((string) $request->get_param('mime_type'));
        $original_filename = sanitize_file_name((string) $request->get_param('original_filename'));

        if (!preg_match('/^[a-f0-9]{64}$/', $sha256)) {
            return new WP_Error('m360_invalid_sha256', 'sha256 deve conter 64 caracteres hexadecimais.', ['status' => 400]);
        }
        if ($provider === null) {
            return self::invalid_media_error('Provider de mídia externa não suportado.', 'unsupported_provider');
        }
        if (!M360_Storage_Provider_Registry::is_enabled($provider)) {
            return self::invalid_media_error('Provider de mídia externa desabilitado.', 'provider_disabled');
        }
        if ($asset_id === '' || $public_id === '' || !self::is_allowed_external_media_url($secure_url, $provider)) {
            return self::invalid_media_error('URL de mídia externa inválida para o provider informado.', 'invalid_external_url');
        }
        if ($width < 1 || $height < 1) {
            return self::invalid_media_error('Dimensões da mídia externa inválidas.', 'invalid_dimensions');
        }
        if (strpos($mime_type, 'image/') !== 0) {
            return self::invalid_media_error('O tipo de mídia externa deve ser uma imagem.', 'invalid_mime_type');
        }

        $existing = self::find_attachment_by_hash($sha256);
        if ($existing > 0) {
            return new WP_REST_Response(self::attachment_payload($existing, true), 200);
        }

        $title = $original_filename !== '' ? pathinfo($original_filename, PATHINFO_FILENAME) : basename($public_id);
        $attachment_id = wp_insert_attachment([
            'post_mime_type' => $mime_type,
            'post_title' => sanitize_text_field($title),
            'post_status' => 'inherit',
            'guid' => $secure_url,
        ], false, 0, true);

        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        update_post_meta($attachment_id, self::META_MARKER, '1');
        update_post_meta($attachment_id, self::META_SHA256, $sha256);
        self::store_provider_metadata((int) $attachment_id, $provider, $asset_id, $public_id, $secure_url);
        update_post_meta($attachment_id, self::META_WIDTH, $width);
        update_post_meta($attachment_id, self::META_HEIGHT, $height);

        return new WP_REST_Response(self::attachment_payload((int) $attachment_id, false), 201);
    }

    public static function assign_to_post(WP_REST_Request $request)
    {
        $post_id = absint($request->get_param('post_id'));
        $attachment_id = absint($request->get_param('attachment_id'));

        if (!$post_id || !current_user_can('edit_post', $post_id)) {
            return new WP_Error('m360_forbidden_post', 'Sem permissão para editar o post.', ['status' => 403]);
        }
        if (get_post_type($attachment_id) !== 'attachment' || !self::is_external_attachment($attachment_id)) {
            return new WP_Error('m360_invalid_attachment', 'O attachment informado não é uma mídia externa M360.', ['status' => 400]);
        }

        set_post_thumbnail($post_id, $attachment_id);
        $fields = [
            'alt' => self::META_ALT,
            'title' => self::META_TITLE,
            'description' => self::META_DESCRIPTION,
            'caption' => self::META_CAPTION,
        ];
        $editorial = [];
        foreach ($fields as $request_key => $meta_key) {
            $value = sanitize_textarea_field((string) $request->get_param($request_key));
            update_post_meta($post_id, $meta_key, $value);
            $editorial[$request_key] = $value;
        }
        update_post_meta($post_id, '_m360_external_featured_media_sha256', get_post_meta($attachment_id, self::META_SHA256, true));
        update_post_meta($post_id, '_m360_external_featured_attachment_id', $attachment_id);

        /*
         * Native attachment fields are global. A shared attachment therefore
         * cannot be overwritten by the EN-US translation. Preserve the first
         * post's values strictly as a legacy-widget fallback; post metadata is
         * the multilingual source of truth.
         */
        $native_editorial_owner = absint(get_post_meta($attachment_id, self::META_NATIVE_EDITORIAL_OWNER, true));
        $native_attachment_meta_updated = false;
        if ($native_editorial_owner === 0) {
            if ($editorial['alt'] !== '') {
                update_post_meta($attachment_id, '_wp_attachment_image_alt', $editorial['alt']);
            }
            wp_update_post([
                'ID' => $attachment_id,
                'post_title' => $editorial['title'] !== '' ? $editorial['title'] : get_the_title($attachment_id),
                'post_excerpt' => $editorial['caption'],
                'post_content' => $editorial['description'],
            ]);
            update_post_meta($attachment_id, self::META_NATIVE_EDITORIAL_OWNER, $post_id);
            $native_attachment_meta_updated = true;
        }

        return new WP_REST_Response([
            'post_id' => $post_id,
            'attachment_id' => $attachment_id,
            'featured_media' => get_post_thumbnail_id($post_id),
            'secure_url' => self::storage_url($attachment_id),
            'editorial_meta' => $editorial,
            'native_attachment_meta_updated' => $native_attachment_meta_updated,
            'native_editorial_owner_post_id' => $native_editorial_owner ?: $post_id,
        ], 200);
    }

    public static function filter_attachment_url(string $url, int $attachment_id): string
    {
        if (!self::is_external_attachment($attachment_id)) {
            return $url;
        }

        $width = (int) get_post_meta($attachment_id, self::META_WIDTH, true);
        $height = (int) get_post_meta($attachment_id, self::META_HEIGHT, true);
        [$target_width, $target_height] = self::mvp_display_size($width, $height);

        return self::delivery_url($attachment_id, $target_width, $target_height, false);
    }

    public static function filter_image_downsize($downsize, int $attachment_id, $size)
    {
        if (!self::is_external_attachment($attachment_id)) {
            return $downsize;
        }

        $width = (int) get_post_meta($attachment_id, self::META_WIDTH, true);
        $height = (int) get_post_meta($attachment_id, self::META_HEIGHT, true);
        // The MVP deliberately ignores theme/component size requests and uses
        // one Cloudinary delivery profile (maximum 768 px, proportional).
        [$target_width, $target_height] = self::mvp_display_size($width, $height);
        $url = self::delivery_url($attachment_id, $target_width, $target_height, false);

        return [$url, $target_width, $target_height, true];
    }

    public static function filter_image_attributes(array $attr, WP_Post $attachment, $size): array
    {
        if (!self::is_external_attachment((int) $attachment->ID)) {
            return $attr;
        }

        $post_id = self::current_featured_post_id((int) $attachment->ID);
        if ($post_id) {
            $alt = (string) get_post_meta($post_id, self::META_ALT, true);
            if ($alt !== '') {
                $attr['alt'] = $alt;
            }
        }

        return $attr;
    }

    public static function filter_attachment_caption(string $caption, int $attachment_id): string
    {
        if (!self::is_external_attachment($attachment_id)) {
            return $caption;
        }

        $post_id = self::current_featured_post_id($attachment_id);
        if (!$post_id) {
            return $caption;
        }

        $localized_caption = (string) get_post_meta($post_id, self::META_CAPTION, true);
        return $localized_caption !== '' ? $localized_caption : $caption;
    }

    /**
     * Registers the virtual featured image directly in Yoast's Open Graph
     * container. Yoast cannot discover a usable local variation for virtual
     * attachments because they intentionally have no file in wp-content/uploads.
     *
     * @param mixed $image_container Yoast Open Graph image container.
     * @return mixed
     */
    public static function add_yoast_opengraph_image($image_container)
    {
        $image = self::current_social_image();
        if ($image === null || !is_object($image_container) || !method_exists($image_container, 'add_image')) {
            return $image_container;
        }

        $image_container->add_image($image);
        return $image_container;
    }

    /**
     * Keeps the X/Twitter image aligned with the same external featured image.
     *
     * @param mixed $image Current image URL produced by Yoast.
     */
    public static function filter_yoast_twitter_image($image): string
    {
        $social_image = self::current_social_image();
        return $social_image !== null ? $social_image['url'] : (string) $image;
    }

    /**
     * Returns social metadata for the external featured image on a singular
     * request. The array matches Yoast's Open Graph image value object.
     */
    private static function current_social_image(): ?array
    {
        if (!is_singular()) {
            return null;
        }

        $post_id = (int) get_queried_object_id();
        $attachment_id = $post_id > 0 ? (int) get_post_thumbnail_id($post_id) : 0;
        if ($attachment_id < 1 || !self::is_external_attachment($attachment_id)) {
            return null;
        }

        $original_width = (int) get_post_meta($attachment_id, self::META_WIDTH, true);
        $original_height = (int) get_post_meta($attachment_id, self::META_HEIGHT, true);
        if ($original_width < 1 || $original_height < 1) {
            return null;
        }

        [$width, $height] = self::mvp_display_size($original_width, $original_height);
        $url = self::delivery_url($attachment_id, $width, $height, false);
        if ($url === '') {
            return null;
        }

        return [
            'url' => $url,
            'width' => $width,
            'height' => $height,
            'type' => (string) get_post_mime_type($attachment_id),
        ];
    }

    private static function find_attachment_by_hash(string $sha256): int
    {
        $ids = get_posts([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'fields' => 'ids',
            'posts_per_page' => 1,
            'meta_key' => self::META_SHA256,
            'meta_value' => $sha256,
        ]);
        return $ids ? (int) $ids[0] : 0;
    }

    private static function attachment_payload(int $attachment_id, bool $existing): array
    {
        $url = self::storage_url($attachment_id);
        return [
            'attachment_id' => $attachment_id,
            'existing' => $existing,
            'sha256' => get_post_meta($attachment_id, self::META_SHA256, true),
            'asset_id' => self::storage_asset_id($attachment_id),
            'public_id' => self::storage_public_id($attachment_id),
            'secure_url' => $url,
            'provider' => self::resolve_storage_provider($attachment_id, $url),
            'url' => $url,
            'width' => (int) get_post_meta($attachment_id, self::META_WIDTH, true),
            'height' => (int) get_post_meta($attachment_id, self::META_HEIGHT, true),
        ];
    }

    private static function is_external_attachment(int $attachment_id): bool
    {
        return get_post_meta($attachment_id, self::META_MARKER, true) === '1';
    }

    private static function current_featured_post_id(int $attachment_id): int
    {
        $post_id = get_the_ID() ?: get_queried_object_id();
        if (!$post_id || get_post_thumbnail_id($post_id) !== $attachment_id) {
            return 0;
        }

        return (int) $post_id;
    }

    private static function store_provider_metadata(int $attachment_id, string $provider, string $asset_id, string $public_id, string $url): void
    {
        update_post_meta($attachment_id, self::META_STORAGE_PROVIDER, $provider);
        update_post_meta($attachment_id, self::META_STORAGE_ASSET_ID, $asset_id);
        update_post_meta($attachment_id, self::META_STORAGE_PUBLIC_ID, $public_id);
        update_post_meta($attachment_id, self::META_STORAGE_URL, $url);

        // Keep the established Cloudinary keys populated for existing n8n
        // consumers and for rollback to versions that predate providers.
        if ($provider === 'cloudinary') {
            update_post_meta($attachment_id, self::META_ASSET_ID, $asset_id);
            update_post_meta($attachment_id, self::META_PUBLIC_ID, $public_id);
            update_post_meta($attachment_id, self::META_URL, $url);
        }
    }

    private static function storage_url(int $attachment_id): string
    {
        $url = (string) get_post_meta($attachment_id, self::META_STORAGE_URL, true);
        return $url !== '' ? $url : (string) get_post_meta($attachment_id, self::META_URL, true);
    }

    private static function storage_asset_id(int $attachment_id): string
    {
        $asset_id = (string) get_post_meta($attachment_id, self::META_STORAGE_ASSET_ID, true);
        return $asset_id !== '' ? $asset_id : (string) get_post_meta($attachment_id, self::META_ASSET_ID, true);
    }

    private static function storage_public_id(int $attachment_id): string
    {
        $public_id = (string) get_post_meta($attachment_id, self::META_STORAGE_PUBLIC_ID, true);
        return $public_id !== '' ? $public_id : (string) get_post_meta($attachment_id, self::META_PUBLIC_ID, true);
    }

    private static function normalize_provider(string $provider): ?string
    {
        $provider = sanitize_key($provider);
        // Provider was not part of the v0.1.7 contract. Empty means legacy
        // Cloudinary so existing workflows remain valid without changes.
        if ($provider === '') {
            return 'cloudinary';
        }

        return M360_Storage_Provider_Registry::provider($provider) !== null ? $provider : null;
    }

    private static function resolve_storage_provider(int $attachment_id, string $url = ''): ?string
    {
        $provider = sanitize_key((string) get_post_meta($attachment_id, self::META_STORAGE_PROVIDER, true));
        if ($provider !== '' && M360_Storage_Provider_Registry::provider($provider) !== null) {
            return $provider;
        }

        $url = $url !== '' ? $url : self::storage_url($attachment_id);
        return M360_Storage_Provider_Registry::infer_provider($url);
    }

    private static function is_allowed_external_media_url(string $url, string $provider): bool
    {
        return M360_Storage_Provider_Registry::validate_url($provider, $url);
    }

    private static function invalid_media_error(string $message, string $reason): WP_Error
    {
        return new WP_Error('m360_invalid_external_media', $message, [
            'status' => 400,
            'reason' => $reason,
        ]);
    }

    private static function mvp_display_size(int $original_width, int $original_height): array
    {
        $width = max(1, min(self::MVP_DISPLAY_WIDTH, $original_width));
        $height = max(1, (int) round($original_height * ($width / $original_width)));

        return [$width, $height];
    }

    private static function delivery_url(int $attachment_id, int $width, int $height, bool $crop): string
    {
        $url = self::storage_url($attachment_id);
        if ($width < 1 || $url === '') {
            return $url;
        }
        $provider = self::resolve_storage_provider($attachment_id, $url);
        if ($provider === null || M360_Storage_Provider_Registry::delivery_mode($provider) !== 'cloudinary_transform') {
            return $url;
        }
        $transform = $crop && $height > 0
            ? sprintf('c_fill,g_auto,w_%d,h_%d', $width, $height)
            : sprintf('c_limit,w_%d', $width);
        return str_replace('/image/upload/', '/image/upload/' . $transform . '/', $url);
    }
}

register_activation_hook(__FILE__, [M360_Storage_Provider_Registry::class, 'activate']);
M360_External_Featured_Media_Pilot::register();
