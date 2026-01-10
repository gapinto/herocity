export type MenuRuleType =
  | 'required' // Item/categoria obrigatória
  | 'maxQuantity' // Quantidade máxima
  | 'minQuantity' // Quantidade mínima
  | 'minTotal' // Valor mínimo do pedido
  | 'requiredItem' // Item específico obrigatório
  | 'comboOrCustom'; // Combo ou pedido customizado

export interface MenuRule {
  type: MenuRuleType;
  category?: string; // Para regras de categoria
  itemName?: string; // Para regras de item específico
  max?: number; // Para maxQuantity
  min?: number; // Para minQuantity
  value?: number; // Para minTotal
  message: string; // Mensagem de erro/aviso
}

export interface MenuCategory {
  keywords: string[];
  items?: string[];
}

export interface MenuRulesConfig {
  orderType?: 'standard' | 'combo';
  rules?: MenuRule[];
  categories?: Record<string, MenuCategory>;
  combos?: Array<{
    name: string;
    items: string[];
    price: number;
  }>;
}

