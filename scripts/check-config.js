#!/usr/bin/env node

/**
 * Script para verificar se todas as variáveis de ambiente obrigatórias estão configuradas
 */

require('dotenv').config();

const required = [
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE_NAME',
  'DATABASE_URL',
  'DEEPSEEK_API_KEY',
];

const optional = [
  'PORT',
  'NODE_ENV',
  'ASAAS_API_KEY',
  'STRIPE_SECRET_KEY',
  'REDIS_URL',
  'ORDER_STATE_STORAGE',
  'WHATSAPP_NUMBER',
];

const missing = required.filter(key => !process.env[key] || process.env[key].trim() === '');

console.log('🔍 Verificando configuração do HeroCity...\n');

if (missing.length > 0) {
  console.error('❌ Variáveis OBRIGATÓRIAS faltando:');
  missing.forEach(key => {
    console.error(`   - ${key}`);
  });
  console.error('\n⚠️  Preencha essas variáveis no arquivo .env antes de continuar!\n');
  process.exit(1);
}

console.log('✅ Todas as variáveis obrigatórias estão configuradas!\n');
console.log('📋 Resumo da Configuração:\n');

// Obrigatórias
console.log('🔴 OBRIGATÓRIAS:');
required.forEach(key => {
  const value = process.env[key];
  const masked = key.includes('KEY') || key.includes('PASSWORD') 
    ? value.substring(0, 8) + '...' 
    : value;
  console.log(`   ✅ ${key}: ${masked}`);
});

// Opcionais
console.log('\n🟡 OPCIONAIS:');
optional.forEach(key => {
  const value = process.env[key];
  if (value) {
    const masked = key.includes('KEY') || key.includes('PASSWORD') || key === 'REDIS_URL'
      ? value.substring(0, 15) + '...'
      : value;
    console.log(`   ✅ ${key}: ${masked}`);
  } else {
    console.log(`   ⚠️  ${key}: Não configurado (opcional)`);
  }
});

// Configurações especiais
console.log('\n📊 Configurações:');
console.log(`   • Storage: ${process.env.ORDER_STATE_STORAGE || 'memory (padrão)'}`);
console.log(`   • Payment Provider: ${process.env.PAYMENT_PROVIDER || 'nenhum (opcional)'}`);
console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   • Port: ${process.env.PORT || '3000'}`);

console.log('\n✨ Configuração pronta! Você pode iniciar a aplicação com: npm run dev\n');
