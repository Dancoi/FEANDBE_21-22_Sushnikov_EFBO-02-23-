const { ApolloServer, gql } = require('apollo-server-express'); 
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const PORT = 8080;
const productsFile = path.join(__dirname, 'data', 'products.json');

// Функции для работы с json файлами
function getProducts() {
    const data = fs.readFileSync(productsFile, 'utf-8');
    return JSON.parse(data);
}

function saveProducts(products) {
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 4), 'utf-8');
}

const typeDefs = gql`
    type Product {
        id: ID!
        name: String!
        price: Float!
        description: String
        categories: [String]
    }

    type Query {
        products: [Product]
        product(id: ID!): Product
    }
`;

const resolvers = {
    Query: {
        products: () => getProducts().products, 
        product: (_, { id }) => getProducts().products.find(p => p.id == id),
    }
};

const app = express();
const server = new ApolloServer({ typeDefs, resolvers });

app.use(cors());
app.use(bodyParser.json());

async function startServer() {
    await server.start();
    server.applyMiddleware({ app });

    const serverEx = app.listen(PORT, () => {
        console.log(`GraphQL API запущен на http://localhost:${PORT}/graphql`);
    });

    // WebSocket-сервер на порту 8080
    const wss = new WebSocket.Server({server: serverEx});
    console.log('WebSocket сервер запущен на ws://localhost:8080');

    return wss;
}



// Запросы на сервер
// Получить все продукты
app.get('/products', (req, res) => {
    res.json(getProducts());
});

// Добавить новый продукт
app.post('/products', (req, res) => {
    const products = getProducts();
    const newProduct = {
        id: products.products.length ? Math.max(...products.products.map(p => p.id)) + 1 : 1,
        ...req.body
    };
    products.products.push(newProduct);
    saveProducts(products);
    res.status(201).json(newProduct);
});

// Редактировать продукт
app.put('/products/:id', (req, res) => {
    const productsData = getProducts();
    const products = productsData.products;

    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex !== -1) {
        products[productIndex] = {
            ...products[productIndex],
            ...req.body
        };

        saveProducts(productsData);
        res.json(products[productIndex]);
    } else {
        res.status(404).json({ message: 'Продукт не найден' });
    }
});

// Удалтиь продукт
app.delete('/products/:id', (req, res) => {
    const products = getProducts();
    const id = parseInt(req.params.id);
    products.products = products.products.filter(p => p.id !== id);
    saveProducts(products);
    res.sendStatus(204);
});


startServer().then(wss => {
        wss.on('connection', (ws) => {
        console.log('Новое подключение к WebSocket серверу');

        ws.on('message', (message) => {

            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message.toString());   
                }
            });
        });

        ws.on('close', () => {
            console.log('Клиент отключился');
        });
    });
}).catch(err => console.error("Ошибка соединения с сервером", err));

