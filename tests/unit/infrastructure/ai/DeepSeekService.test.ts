import { DeepSeekService, IntentResult } from '../../../../src/infrastructure/ai/DeepSeekService';
import { Intent } from '../../../../src/domain/enums/Intent';
import { UserContext } from '../../../../src/domain/enums/UserContext';
import { MenuRulesConfig } from '../../../../src/domain/types/MenuRules';

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('DeepSeekService', () => {
  let service: DeepSeekService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
    };

    axios.create = jest.fn(() => mockAxiosInstance);
    service = new DeepSeekService();
  });

  it('should identify intent without menu items and rules', async () => {
    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO,
      confidence: 0.9,
    };

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(result),
            },
          },
        ],
      },
    });

    const response = await service.identifyIntent('quero fazer um pedido', UserContext.CUSTOMER);

    expect(response.intent).toBe(Intent.CRIAR_PEDIDO);
    expect(response.confidence).toBe(0.9);
    expect(mockAxiosInstance.post).toHaveBeenCalled();
  });

  it('should identify intent with menu items', async () => {
    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.95,
      items: [{ name: 'Hambúrguer', quantity: 2 }],
    };

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(result),
            },
          },
        ],
      },
    });

    const menuItems = [
      { name: 'Hambúrguer', price: 'R$ 25,00' },
      { name: 'Refrigerante', price: 'R$ 5,00' },
    ];

    const response = await service.identifyIntent(
      'quero 2 hambúrgueres',
      UserContext.CUSTOMER,
      menuItems
    );

    expect(response.intent).toBe(Intent.CRIAR_PEDIDO_QR_CODE);
    expect(response.items).toEqual([{ name: 'Hambúrguer', quantity: 2 }]);
  });

  it('should identify intent with menu rules', async () => {
    const menuRules: MenuRulesConfig = {
      orderType: 'combo',
      rules: [
        {
          type: 'required',
          category: 'protein',
          message: 'Escolha uma proteína',
        },
        {
          type: 'maxQuantity',
          category: 'side',
          max: 3,
          message: 'Máximo 3 acompanhamentos',
        },
      ],
      categories: {
        protein: {
          keywords: ['frango', 'carne', 'peixe'],
        },
        side: {
          keywords: ['arroz', 'feijão', 'batata'],
        },
      },
    };

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.95,
      items: [
        { name: 'Frango Grelhado', quantity: 1, category: 'protein' },
        { name: 'Arroz', quantity: 1, category: 'side' },
      ],
      validation: {
        isValid: true,
        isComplete: true,
        missingRequired: [],
        warnings: [],
        errors: [],
      },
    };

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(result),
            },
          },
        ],
      },
    });

    const menuItems = [
      { name: 'Frango Grelhado', price: 'R$ 25,00' },
      { name: 'Arroz', price: 'R$ 0,00' },
    ];

    const response = await service.identifyIntent(
      'quero um combo com frango e arroz',
      UserContext.CUSTOMER,
      menuItems,
      menuRules
    );

    expect(response.intent).toBe(Intent.CRIAR_PEDIDO_QR_CODE);
    expect(response.validation).toBeDefined();
    expect(response.validation?.isValid).toBe(true);
    expect(response.validation?.isComplete).toBe(true);
  });

  it('should return validation with missing required items', async () => {
    const menuRules: MenuRulesConfig = {
      orderType: 'combo',
      rules: [
        {
          type: 'required',
          category: 'protein',
          message: 'Escolha uma proteína',
        },
      ],
    };

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.9,
      items: [{ name: 'Arroz', quantity: 1, category: 'side' }],
      validation: {
        isValid: true,
        isComplete: false,
        missingRequired: ['proteína'],
        warnings: [],
        errors: [],
      },
    };

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(result),
            },
          },
        ],
      },
    });

    const response = await service.identifyIntent(
      'quero só arroz',
      UserContext.CUSTOMER,
      [{ name: 'Arroz', price: 'R$ 0,00' }],
      menuRules
    );

    expect(response.validation?.isComplete).toBe(false);
    expect(response.validation?.missingRequired).toContain('proteína');
  });

  it('should return validation with errors for invalid order', async () => {
    const menuRules: MenuRulesConfig = {
      orderType: 'standard',
      rules: [
        {
          type: 'minTotal',
          value: 30.0,
          message: 'Pedido mínimo de R$ 30,00',
        },
      ],
    };

    const result: IntentResult = {
      intent: Intent.CRIAR_PEDIDO_QR_CODE,
      confidence: 0.9,
      items: [{ name: 'Refrigerante', quantity: 1 }],
      validation: {
        isValid: false,
        isComplete: true,
        missingRequired: [],
        warnings: [],
        errors: ['Pedido mínimo de R$ 30,00 não atingido'],
      },
    };

    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(result),
            },
          },
        ],
      },
    });

    const response = await service.identifyIntent(
      'quero só um refrigerante',
      UserContext.CUSTOMER,
      [{ name: 'Refrigerante', price: 'R$ 5,00' }],
      menuRules
    );

    expect(response.validation?.isValid).toBe(false);
    expect(response.validation?.errors).toContain('Pedido mínimo de R$ 30,00 não atingido');
  });

  it('should handle API errors gracefully', async () => {
    mockAxiosInstance.post.mockRejectedValue(new Error('API Error'));

    const response = await service.identifyIntent('test', UserContext.CUSTOMER);

    expect(response.intent).toBe(Intent.SOLICITAR_AJUDA);
    expect(response.confidence).toBe(0.0);
  });
});

