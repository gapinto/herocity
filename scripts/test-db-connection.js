const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Testando conexão com o banco de dados...');
    
    // Tenta conectar
    await prisma.$connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Testa uma query simples
    const restaurantCount = await prisma.restaurant.count();
    console.log(`📊 Total de restaurantes no banco: ${restaurantCount}`);
    
    const orderCount = await prisma.order.count();
    console.log(`📊 Total de pedidos no banco: ${orderCount}`);
    
    const customerCount = await prisma.customer.count();
    console.log(`📊 Total de clientes no banco: ${customerCount}`);
    
    console.log('\n✨ Banco de dados configurado e funcionando!');
    
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
