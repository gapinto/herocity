export class Price {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): Price {
    if (value < 0) {
      throw new Error('Price cannot be negative');
    }

    if (!Number.isFinite(value)) {
      throw new Error('Price must be a finite number');
    }

    return new Price(Math.round(value * 100) / 100); // Arredonda para 2 casas decimais
  }

  getValue(): number {
    return this.value;
  }

  getFormatted(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(this.value);
  }

  add(other: Price): Price {
    return Price.create(this.value + other.value);
  }

  multiply(quantity: number): Price {
    return Price.create(this.value * quantity);
  }

  equals(other: Price): boolean {
    return this.value === other.value;
  }
}

