const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sua_chave_secreta_aqui';

app.use(cors());
app.use(express.json());

// Rota de registro
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Criptografar senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Inserir usuário no banco
        db.run(
            'INSERT INTO users (email, password) VALUES (?, ?)',
            [email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email já cadastrado' });
                    }
                    return res.status(500).json({ error: 'Erro ao criar usuário' });
                }
                res.status(201).json({ message: 'Usuário criado com sucesso' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Rota de login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscar usuário
        db.get(
            'SELECT * FROM users WHERE email = ?',
            [email],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro ao buscar usuário' });
                }

                if (!user) {
                    return res.status(401).json({ error: 'Credenciais inválidas' });
                }

                // Verificar senha
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Credenciais inválidas' });
                }

                // Gerar token
                const token = jwt.sign(
                    { userId: user.id, email: user.email },
                    SECRET_KEY,
                    { expiresIn: '1h' }
                );

                res.json({ token });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};
// No início do arquivo, após as importações
app.use((req, res, next) => {
    next();
});

// Na rota de transações
app.get('/api/transactions', authenticateToken, (req, res) => {
    try {
        db.all(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.userId],
            (err, transactions) => {
                if (err) {
                    console.error('Erro no banco:', err);
                    return res.status(500).json({ error: 'Erro ao buscar transações' });
                }
                res.json(transactions || []);
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
// Adicione as categorias válidas
const CATEGORIAS = {
    RECEITAS: ['salario', 'investimentos', 'outros'],
    DESPESAS: ['alimentacao', 'transporte', 'lazer', 'contas', 'outros']
};
// Update the transactions table creation
db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'outros',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
// Update the POST route for transactions
app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { description, amount, type, category } = req.body;

    try {
        const now = new Date();
        const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
            now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));

        const result = await db.run(
            'INSERT INTO transactions (user_id, description, amount, type, category, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.userId, description, amount, type, category, utcDate.toISOString()]
        );

        res.json({ id: result.lastID });
    } catch (error) {
        console.error('Erro ao criar transação:', error);
        res.status(500).json({ error: 'Erro ao criar transação' });
    }
});
// Rota para deletar transação
app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const transactionId = req.params.id;
    const userId = req.user.userId;

    // Verificar se a transação pertence ao usuário antes de deletar
    db.run(
        'DELETE FROM transactions WHERE id = ? AND user_id = ?',
        [transactionId, userId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao excluir transação' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Transação não encontrada' });
            }
            res.json({ message: 'Transação excluída com sucesso' });
        }
    );
});
// Rota para obter informações do usuário
app.get('/api/user', authenticateToken, (req, res) => {
    try {

        db.get(
            'SELECT id, email FROM users WHERE id = ?',
            [req.user.userId],
            (err, user) => {
                if (err) {
                    console.error('Erro ao buscar usuário:', err);
                    return res.status(500).json({ error: 'Erro ao buscar informações do usuário' });
                }
                if (!user) {
                    return res.status(404).json({ error: 'Usuário não encontrado' });
                }
                res.json({ email: user.email });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});