<?php
if (!defined('ABSPATH')) {
    exit;
}

final class M360_Storage_Provider_Registry
{
    private const OPTION = 'm360_external_storage_provider_registry';
    private const DELIVERY_MODES = ['cloudinary_transform', 'passthrough'];

    public static function register(): void
    {
        self::ensure_initialized();
        add_action('admin_menu', [self::class, 'register_admin_page'], 100);
        add_action('admin_post_m360_save_storage_provider_registry', [self::class, 'handle_save']);
        add_action('admin_post_m360_test_storage_provider_url', [self::class, 'handle_test_url']);
    }

    public static function activate(): void
    {
        self::ensure_initialized();
    }

    public static function ensure_initialized(): void
    {
        if (get_option(self::OPTION, null) === null) {
            add_option(self::OPTION, self::defaults(), '', false);
        }
    }

    public static function providers(): array
    {
        $stored = get_option(self::OPTION, null);
        if (!is_array($stored)) {
            return self::defaults();
        }

        return self::with_required_defaults(self::sanitize_registry($stored, true));
    }

    public static function provider(string $provider_key): ?array
    {
        $provider_key = sanitize_key($provider_key);
        foreach (self::providers() as $provider) {
            if ($provider['provider_key'] === $provider_key) {
                return $provider;
            }
        }
        return null;
    }

    public static function is_enabled(string $provider_key): bool
    {
        $provider = self::provider($provider_key);
        return $provider !== null && $provider['enabled'];
    }

    public static function enabled_providers(): array
    {
        return array_values(array_filter(self::providers(), static fn (array $provider): bool => $provider['enabled']));
    }

    public static function delivery_mode(string $provider_key): ?string
    {
        $provider = self::provider($provider_key);
        return $provider !== null ? $provider['delivery_mode'] : null;
    }

    public static function validate_url(string $provider_key, string $url): bool
    {
        $provider = self::provider($provider_key);
        if ($provider === null || !$provider['enabled']) {
            return false;
        }

        $parts = wp_parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            return false;
        }

        $host = self::normalize_host((string) ($parts['host'] ?? ''));
        if ($host === '') {
            return false;
        }

        return self::host_allowed($host, $provider);
    }

    /**
     * Provider inference is intentionally independent from enabled state.
     * Disabling a provider blocks new registrations but cannot break media
     * that has already been published.
     */
    public static function infer_provider(string $url): ?string
    {
        $parts = wp_parse_url($url);
        $host = is_array($parts) ? self::normalize_host((string) ($parts['host'] ?? '')) : '';
        if ($host === '') {
            return null;
        }

        foreach (self::providers() as $provider) {
            if (self::host_allowed($host, $provider)) {
                return $provider['provider_key'];
            }
        }
        return null;
    }

    public static function register_admin_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        add_submenu_page(
            self::parent_slug(),
            'Storage Provider Registry',
            'Storage Providers',
            'manage_options',
            'm360-storage-provider-registry',
            [self::class, 'render_admin_page']
        );
    }

    public static function render_admin_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $providers = self::providers();
        $providers[] = [
            'provider_key' => '',
            'label' => '',
            'enabled' => false,
            'allowed_hosts' => [],
            'allowed_host_patterns' => [],
            'delivery_mode' => 'passthrough',
        ];
        ?>
        <div class="wrap">
            <h1>Storage Provider Registry</h1>
            <p>Autoriza providers lógicos, hosts e política de entrega. Credenciais, contas, buckets, upload, quotas e rodízio permanecem fora do WordPress.</p>
            <?php if (isset($_GET['updated'])): ?>
                <div class="notice notice-success is-dismissible"><p>Registry atualizado.</p></div>
            <?php endif; ?>
            <?php if (isset($_GET['invalid'])): ?>
                <div class="notice notice-error"><p>Uma ou mais configurações foram descartadas por serem inválidas.</p></div>
            <?php endif; ?>
            <?php if (isset($_GET['test_result'])):
                $test_valid = sanitize_key((string) wp_unslash($_GET['test_result'])) === 'valid';
            ?>
                <div class="notice <?php echo $test_valid ? 'notice-success' : 'notice-error'; ?> is-dismissible"><p><?php echo esc_html($test_valid ? 'URL autorizada pelo provider selecionado.' : 'URL recusada pelo provider selecionado.'); ?></p></div>
            <?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="m360_save_storage_provider_registry">
                <?php wp_nonce_field('m360_save_storage_provider_registry'); ?>
                <table class="widefat striped" style="max-width:1400px">
                    <thead><tr><th>Provider key</th><th>Nome</th><th>Ativo</th><th>Hosts exatos</th><th>Patterns seguros</th><th>Entrega</th><th>Remover</th></tr></thead>
                    <tbody>
                    <?php foreach ($providers as $index => $provider):
                        $is_protected = self::is_protected($provider['provider_key']);
                    ?>
                        <tr>
                            <td><input type="text" name="providers[<?php echo esc_attr((string) $index); ?>][provider_key]" value="<?php echo esc_attr($provider['provider_key']); ?>" pattern="[a-z0-9_]+" placeholder="provider_key"<?php echo $is_protected ? ' readonly' : ''; ?>></td>
                            <td><input type="text" name="providers[<?php echo esc_attr((string) $index); ?>][label]" value="<?php echo esc_attr($provider['label']); ?>" placeholder="Nome editorial"></td>
                            <td><label><input type="checkbox" name="providers[<?php echo esc_attr((string) $index); ?>][enabled]" value="1" <?php checked($provider['enabled']); ?>> habilitado</label></td>
                            <td><textarea name="providers[<?php echo esc_attr((string) $index); ?>][allowed_hosts]" rows="3" placeholder="media.example.com"><?php echo esc_textarea(implode("\n", $provider['allowed_hosts'])); ?></textarea></td>
                            <td><textarea name="providers[<?php echo esc_attr((string) $index); ?>][allowed_host_patterns]" rows="3" placeholder="*.r2.dev"><?php echo esc_textarea(implode("\n", $provider['allowed_host_patterns'])); ?></textarea></td>
                            <td><select name="providers[<?php echo esc_attr((string) $index); ?>][delivery_mode]">
                                <option value="passthrough" <?php selected($provider['delivery_mode'], 'passthrough'); ?>>passthrough</option>
                                <option value="cloudinary_transform" <?php selected($provider['delivery_mode'], 'cloudinary_transform'); ?>>cloudinary_transform</option>
                            </select></td>
                            <td><?php if ($provider['provider_key'] === ''): ?>Nova entrada<?php elseif ($is_protected): ?>Protegido<?php else: ?><label><input type="checkbox" name="providers[<?php echo esc_attr((string) $index); ?>][delete]" value="1"> remover</label><?php endif; ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <p class="description">Use hosts sem protocolo ou caminho. Patterns aceitam apenas wildcard de subdomínio no formato <code>*.example.com</code>.</p>
                <?php submit_button('Salvar providers'); ?>
            </form>
            <hr>
            <h2>Testar URL</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="m360_test_storage_provider_url">
                <?php wp_nonce_field('m360_test_storage_provider_url'); ?>
                <table class="form-table"><tbody><tr>
                    <th><label for="m360-test-provider">Provider</label></th>
                    <td><select id="m360-test-provider" name="provider_key" required>
                        <?php foreach (self::providers() as $provider): ?>
                            <option value="<?php echo esc_attr($provider['provider_key']); ?>"><?php echo esc_html($provider['label'] . ' (' . $provider['provider_key'] . ')'); ?></option>
                        <?php endforeach; ?>
                    </select></td>
                </tr><tr>
                    <th><label for="m360-test-url">URL HTTPS</label></th>
                    <td><input id="m360-test-url" class="regular-text" type="url" name="test_url" placeholder="https://media.example.com/image.jpg" required></td>
                </tr></tbody></table>
                <?php submit_button('Testar URL', 'secondary'); ?>
            </form>
        </div>
        <?php
    }

    public static function handle_save(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão para gerenciar providers.', '', ['response' => 403]);
        }
        check_admin_referer('m360_save_storage_provider_registry');

        $input = isset($_POST['providers']) && is_array($_POST['providers'])
            ? wp_unslash($_POST['providers'])
            : [];
        $clean = self::sanitize_registry($input, false);
        $invalid = count($clean) !== count(array_filter($input, static function ($row): bool {
            return is_array($row) && empty($row['delete']) && trim((string) ($row['provider_key'] ?? '')) !== '';
        }));

        $complete = self::with_required_defaults($clean);
        if (count($complete) !== count($clean)) {
            $invalid = true;
        }

        update_option(self::OPTION, array_values($complete), false);
        $url = add_query_arg(
            $invalid ? 'invalid' : 'updated',
            '1',
            self::admin_page_url()
        );
        wp_safe_redirect($url);
        exit;
    }

    public static function handle_test_url(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('Sem permissão para testar providers.', '', ['response' => 403]);
        }
        check_admin_referer('m360_test_storage_provider_url');

        $provider_key = sanitize_key((string) wp_unslash($_POST['provider_key'] ?? ''));
        $url = esc_url_raw((string) wp_unslash($_POST['test_url'] ?? ''));
        $result = self::validate_url($provider_key, $url) ? 'valid' : 'invalid';
        wp_safe_redirect(add_query_arg('test_result', $result, self::admin_page_url()));
        exit;
    }

    private static function defaults(): array
    {
        return [
            [
                'provider_key' => 'cloudinary',
                'label' => 'Cloudinary',
                'enabled' => true,
                'allowed_hosts' => ['res.cloudinary.com'],
                'allowed_host_patterns' => [],
                'delivery_mode' => 'cloudinary_transform',
            ],
            [
                'provider_key' => 'cloudflare_r2',
                'label' => 'Cloudflare R2',
                'enabled' => true,
                'allowed_hosts' => ['pub-4fc4737db70147a8bec050dd7fb883d7.r2.dev'],
                'allowed_host_patterns' => ['*.r2.dev'],
                'delivery_mode' => 'passthrough',
            ],
        ];
    }

    private static function with_required_defaults(array $providers): array
    {
        $keys = array_column($providers, 'provider_key');
        foreach (self::defaults() as $default) {
            if (!in_array($default['provider_key'], $keys, true)) {
                $providers[] = $default;
            }
        }
        return array_values($providers);
    }

    private static function sanitize_registry(array $registry, bool $keep_existing): array
    {
        $clean = [];
        foreach ($registry as $row) {
            if (!is_array($row) || (!$keep_existing && !empty($row['delete']))) {
                continue;
            }

            $provider_key = sanitize_key((string) ($row['provider_key'] ?? ''));
            $label = sanitize_text_field((string) ($row['label'] ?? ''));
            $delivery_mode = sanitize_key((string) ($row['delivery_mode'] ?? ''));
            if ($provider_key === '' || !preg_match('/^[a-z0-9_]+$/', $provider_key) || $label === '' || !in_array($delivery_mode, self::DELIVERY_MODES, true)) {
                continue;
            }

            $hosts = self::sanitize_list($row['allowed_hosts'] ?? [], false);
            $patterns = self::sanitize_list($row['allowed_host_patterns'] ?? [], true);
            if ($provider_key === 'cloudinary') {
                $hosts[] = 'res.cloudinary.com';
                $hosts = array_values(array_unique($hosts));
                $delivery_mode = 'cloudinary_transform';
            }
            if ($provider_key === 'cloudflare_r2') {
                $delivery_mode = 'passthrough';
            }
            if ($hosts === [] && $patterns === []) {
                continue;
            }

            $clean[$provider_key] = [
                'provider_key' => $provider_key,
                'label' => $label,
                'enabled' => !empty($row['enabled']),
                'allowed_hosts' => $hosts,
                'allowed_host_patterns' => $patterns,
                'delivery_mode' => $delivery_mode,
            ];
        }
        return array_values($clean);
    }

    private static function sanitize_list($value, bool $patterns): array
    {
        if (is_string($value)) {
            $value = preg_split('/[\r\n,]+/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }

        $clean = [];
        foreach ($value as $item) {
            $item = strtolower(trim((string) $item));
            if ($patterns) {
                if (!preg_match('/^\*\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/', $item)) {
                    continue;
                }
                $clean[] = $item;
                continue;
            }

            $host = self::normalize_host($item);
            if ($host !== '' && preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/', $host)) {
                $clean[] = $host;
            }
        }
        return array_values(array_unique($clean));
    }

    private static function normalize_host(string $host): string
    {
        return strtolower(rtrim(trim($host), '.'));
    }

    private static function host_allowed(string $host, array $provider): bool
    {
        if (in_array($host, $provider['allowed_hosts'], true)) {
            return true;
        }

        foreach ($provider['allowed_host_patterns'] as $pattern) {
            $suffix = substr($pattern, 1); // Keeps the leading dot from *.example.com.
            if ($suffix !== '' && str_ends_with($host, $suffix) && $host !== ltrim($suffix, '.')) {
                return true;
            }
        }
        return false;
    }

    private static function parent_slug(): string
    {
        $parent = (string) apply_filters('m360_storage_provider_registry_parent_slug', 'm360-dashboard');
        global $admin_page_hooks;
        return $parent !== '' && isset($admin_page_hooks[$parent]) ? $parent : 'options-general.php';
    }

    private static function is_protected(string $provider_key): bool
    {
        return in_array($provider_key, ['cloudinary', 'cloudflare_r2'], true);
    }

    private static function admin_page_url(): string
    {
        $parent = self::parent_slug();
        $base = $parent === 'options-general.php' ? 'options-general.php' : 'admin.php';
        return admin_url($base . '?page=m360-storage-provider-registry');
    }
}
