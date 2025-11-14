
const express = require('express');
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const openapi = require('./openapi.json')
const jwt = require('jsonwebtoken')
const { expressjwt: expressJwt } = require('express-jwt')
const JWT_SECRET = process.env.JWT_SECRET || 'GoodSecret2006'
const app = express();
const itemModel = require('./models/item')

// Example middleware: logs request method and URL
app.use((req, res, next) => {
	console.log(`${req.method} ${req.url}`);
	next();
});

// CORS: allow any origin (wildcard). Using the `cors` package makes this explicit
// and avoids subtle header ordering issues.
app.use(cors({ origin: '*' }))

// Swagger UI - serves OpenAPI docs at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi))

// Parse JSON bodies (for POST requests)
app.use(express.json());

// Default page
app.get('/', (req, res) => {
	res.send('Welcome to the LW Tech!');
});

// About page
app.get('/about', (req, res) => {
	res.send('This is the About Page.');
});

// Contact page
app.get('/contact', (req, res) => {
	res.send('Contact us at contact@example.com');
});

// Example POST handler
app.post('/contact', (req, res) => {
	const { name, message } = req.body;
	res.send(`Thank you, ${name}. Your message: "${message}" has been received.`);
});

// Simple login to issue a JWT for demo purposes.
// In a real app you'd validate credentials against a user store.
app.post('/login', (req, res) => {
	const { username, password } = req.body || {}
	if (!username || !password) return res.status(400).json({ error: 'username and password required' })
	// demo: accept any credentials
	const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' })
	res.json({ token })
})

// express-jwt middleware: validates JWT and attaches payload to req.auth
const jwtMiddleware = expressJwt({ secret: JWT_SECRET, algorithms: ['HS256'] })

// Small adapter: copy req.auth (express-jwt) to req.user for compatibility
function attachUser(req, res, next) {
	if (req.auth) req.user = req.auth
	next()
}

// Global error handler to convert express-jwt errors into JSON responses
app.use((err, req, res, next) => {
	if (err && err.name === 'UnauthorizedError') {
		return res.status(401).json({ error: 'Invalid or expired token' })
	}
	next(err)
})

// Items API
// GET /items - list all items
app.get('/items', async (req, res) => {
	try {
		const rows = await itemModel.list()
		res.json(rows)
	} catch (err) {
		console.error('GET /items error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /items/:id - get single item
app.get('/items/:id', async (req, res) => {
	try {
		const it = await itemModel.get(req.params.id)
		if (!it) return res.status(404).json({ error: 'Item not found' })
		res.json(it)
	} catch (err) {
		console.error('GET /items/:id error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// POST /items - create new item (protected)
app.post('/items', jwtMiddleware, attachUser, async (req, res) => {
	try {
		const validation = itemModel.validate(req.body)
		if (!validation.valid) return res.status(400).json({ error: validation.error })
		const created = await itemModel.create(req.body)
		res.status(201).json(created)
	} catch (err) {
		console.error('POST /items error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// PUT /items/:id - update existing item (protected)
app.put('/items/:id', jwtMiddleware, attachUser, async (req, res) => {
	try {
		const existing = await itemModel.get(req.params.id)
		if (!existing) return res.status(404).json({ error: 'Item not found' })
		const validation = itemModel.validate({ name: req.body.name ?? existing.name, description: req.body.description ?? existing.description })
		if (!validation.valid) return res.status(400).json({ error: validation.error })
		const updated = await itemModel.update(req.params.id, req.body)
		res.json(updated)
	} catch (err) {
		console.error('PUT /items/:id error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// DELETE /items/:id - delete item (protected)
app.delete('/items/:id', jwtMiddleware, attachUser, async (req, res) => {
	try {
		const existing = await itemModel.get(req.params.id)
		if (!existing) return res.status(404).json({ error: 'Item not found' })
		await itemModel.delete(req.params.id)
		res.status(204).end()
	} catch (err) {
		console.error('DELETE /items/:id error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

// GET /NumItems - return the number of items in the database
app.get('/NumItems', async (req, res) => {
	try {
		// Use the exposed Sequelize Model to perform a fast COUNT
		const count = await itemModel.Model.count()
		res.json({ count })
	} catch (err) {
		console.error('GET /NumItems error', err)
		res.status(500).json({ error: 'Internal server error' })
	}
})

const PORT = 3000;

if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`Express server running at http://localhost:${PORT}`);
	});
}

module.exports = app
