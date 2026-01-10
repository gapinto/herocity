import { Price } from '../../../../src/domain/value-objects/Price';

describe('Price', () => {
  describe('create', () => {
    it('should create a valid price', () => {
      const price = Price.create(10.50);
      expect(price.getValue()).toBe(10.50);
    });

    it('should round to 2 decimal places', () => {
      const price = Price.create(10.555);
      expect(price.getValue()).toBe(10.56);
    });

    it('should throw error for negative price', () => {
      expect(() => Price.create(-10)).toThrow('Price cannot be negative');
    });

    it('should throw error for non-finite number', () => {
      expect(() => Price.create(Infinity)).toThrow('Price must be a finite number');
      expect(() => Price.create(NaN)).toThrow('Price must be a finite number');
    });
  });

  describe('getFormatted', () => {
    it('should format price as Brazilian currency', () => {
      const price = Price.create(10.50);
      expect(price.getFormatted()).toContain('R$');
      expect(price.getFormatted()).toContain('10,50');
    });
  });

  describe('add', () => {
    it('should add two prices', () => {
      const price1 = Price.create(10.50);
      const price2 = Price.create(5.25);
      const result = price1.add(price2);
      expect(result.getValue()).toBe(15.75);
    });
  });

  describe('multiply', () => {
    it('should multiply price by quantity', () => {
      const price = Price.create(10.50);
      const result = price.multiply(3);
      expect(result.getValue()).toBe(31.50);
    });
  });

  describe('equals', () => {
    it('should return true for equal prices', () => {
      const price1 = Price.create(10.50);
      const price2 = Price.create(10.50);
      expect(price1.equals(price2)).toBe(true);
    });

    it('should return false for different prices', () => {
      const price1 = Price.create(10.50);
      const price2 = Price.create(10.51);
      expect(price1.equals(price2)).toBe(false);
    });
  });
});

