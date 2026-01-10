export class Phone {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): Phone {
    if (!value || value.trim().length === 0) {
      throw new Error('Phone number cannot be empty');
    }

    // Remove caracteres não numéricos
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error('Phone number must have between 10 and 15 digits');
    }

    return new Phone(cleaned);
  }

  getValue(): string {
    return this.value;
  }

  getFormatted(): string {
    // Formata como (XX) XXXXX-XXXX para números brasileiros
    if (this.value.length === 11) {
      return `(${this.value.slice(0, 2)}) ${this.value.slice(2, 7)}-${this.value.slice(7)}`;
    }
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}

