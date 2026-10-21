const itens = $input.all();

return itens.map(item => {
  const x = item.json;

  const percentual = Number(x.credit_percent ?? 0);
  const usados = Number(x.credit_used ?? 0);
  const limite = Number(x.credit_limit ?? 0);

  let status = 'NORMAL';
  let permitePublicacao = true;
  let permiteMigracao = true;
  let prioridade = 1;

  if (percentual >= 95) {
    status = 'BLOQUEADA';
    permitePublicacao = false;
    permiteMigracao = false;
    prioridade = 5;

  } else if (percentual >= 90) {
    status = 'CRITICA';
    permitePublicacao = true;
    permiteMigracao = false;
    prioridade = 4;

  } else if (percentual >= 85) {
    status = 'RESTRITA';
    permitePublicacao = true;
    permiteMigracao = false;
    prioridade = 3;

  } else if (percentual >= 70) {
    status = 'ATENCAO';
    permitePublicacao = true;
    permiteMigracao = true;
    prioridade = 2;
  }

  const creditoDisponivel = Math.max(
    limite - usados,
    0
  );

  return {
    json: {
      ...x,

      credit_available:
        Number(creditoDisponivel.toFixed(4)),

      status_operacional:
        status,

      permite_publicacao:
        permitePublicacao ? 1 : 0,

      permite_migracao:
        permiteMigracao ? 1 : 0,

      prioridade_operacional:
        prioridade
    }
  };
});
