import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function createTables() {
  try {
    console.log('🔄 Lendo arquivo SQL...');
    const sqlFile = path.join(__dirname, 'create-missing-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Divide em comandos individuais (separados por ;)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          await prisma.$executeRawUnsafe(command);
        } catch (error: any) {
          // Ignora erros de "já existe" ou similares
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.warn(`⚠️  Aviso: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Tabelas criadas/atualizadas com sucesso!');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTables();
