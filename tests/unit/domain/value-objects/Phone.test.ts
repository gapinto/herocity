import { Phone } from '../../../../src/domain/value-objects/Phone';

describe('Phone', () => {
  describe('create', () => {
    it('should create a valid phone number', () => {
      const phone = Phone.create('81999999999');
      expect(phone.getValue()).toBe('81999999999');
    });

    it('should remove non-numeric characters', () => {
      const phone = Phone.create('(81) 99999-9999');
      expect(phone.getValue()).toBe('81999999999');
    });

    it('should throw error for empty phone', () => {
      expect(() => Phone.create('')).toThrow('Phone number cannot be empty');
      expect(() => Phone.create('   ')).toThrow('Phone number cannot be empty');
    });

    it('should throw error for invalid length', () => {
      expect(() => Phone.create('12345')).toThrow('Phone number must have between 10 and 15 digits');
      expect(() => Phone.create('1234567890123456')).toThrow('Phone number must have between 10 and 15 digits');
    });
  });

  describe('getFormatted', () => {
    it('should format 11-digit phone as Brazilian format', () => {
      const phone = Phone.create('81999999999');
      expect(phone.getFormatted()).toBe('(81) 99999-9999');
    });

    it('should return original value for non-11-digit phones', () => {
      const phone = Phone.create('1234567890');
      expect(phone.getFormatted()).toBe('1234567890');
    });
  });

  describe('equals', () => {
    it('should return true for equal phones', () => {
      const phone1 = Phone.create('81999999999');
      const phone2 = Phone.create('81999999999');
      expect(phone1.equals(phone2)).toBe(true);
    });

    it('should return false for different phones', () => {
      const phone1 = Phone.create('81999999999');
      const phone2 = Phone.create('81888888888');
      expect(phone1.equals(phone2)).toBe(false);
    });
  });
});

