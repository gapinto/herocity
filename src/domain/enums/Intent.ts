export enum Intent {
  // Customer intents
  CRIAR_PEDIDO = 'criar_pedido',
  CRIAR_PEDIDO_QR_CODE = 'criar_pedido_qr_code', // Novo: quando vem de QR code na mesa
  ADICIONAR_ITEM = 'adicionar_item',
  REMOVER_ITEM = 'remover_item',
  ALTERAR_ITEM = 'alterar_item',
  CONSULTAR_STATUS_PEDIDO = 'consultar_status_pedido',
  CANCELAR_PEDIDO = 'cancelar_pedido',
  SOLICITAR_AJUDA = 'solicitar_ajuda',
  
  // Restaurant intents
  RESTAURANT_ONBOARDING = 'restaurant_onboarding',
  ATUALIZAR_ESTOQUE = 'atualizar_estoque',
  MARCAR_PEDIDO_PREPARO = 'marcar_pedido_preparo',
  MARCAR_PEDIDO_PRONTO = 'marcar_pedido_pronto',
  CONSULTAR_PEDIDOS_PENDENTES = 'consultar_pedidos_pendentes',
  NOTIFICAR_CLIENTE = 'notificar_cliente',
  BLOQUEAR_ITEM_CARDAPIO = 'bloquear_item_cardapio',
  DESBLOQUEAR_ITEM_CARDAPIO = 'desbloquear_item_cardapio',
}
