const express = require('express');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { Client, NoAuth } = require('whatsapp-web.js');
const { body, validationResult } = require('express-validator');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const port = process.env.PORT || 5000;
const { phoneNumberFormatter } = require('./helpers/formatter');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

// To support URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// To parse cookies from the HTTP Request
app.use(cookieParser());

app.engine('hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: "main"
}));

app.set('view engine', 'hbs');

// Our requests hadlers will be implemented here...

app.get('/', function (req, res) {
    res.render('login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

const crypto = require('crypto');

const getHashedPassword = (password) => {
    const sha256 = crypto.createHash('sha256');
    const hash = sha256.update(password).digest('base64');
    return hash;
}

const users = [
    // This user is added to the array to avoid creating a new user on each restart
    {
        firstName: 'Ahmad',
        lastName: 'Mamad',
        email: 'AhmadSyah@gmail.com',
        // This is the SHA256 hash for value of `password`
        password: '9/i+px3Fn14YIq02tLrb2FOcXfK0tPJkL7NO2JjTuM4='
    }
];

const generateAuthToken = () => {
    return crypto.randomBytes(30).toString('hex');
}

// This will hold the users and authToken related to users
const authTokens = {};

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = getHashedPassword(password);

    const user = users.find(u => {
        return u.email === email && hashedPassword === u.password
    });

    if (user) {
        const authToken = generateAuthToken();

        // Store authentication token
        authTokens[authToken] = user;

        // Setting the auth token in cookies
        res.cookie('AuthToken', authToken);

        // Redirect user to the protected page
        res.redirect('/whatsapp_');
    } else {
        res.render('login', {
            message: 'Invalid username or password',
            messageClass: 'alert-danger'
        });
    }
});

app.use((req, res, next) => {
    // Get auth token from the cookies
    const authToken = req.cookies['AuthToken'];

    // Inject the user to the request
    req.user = authTokens[authToken];

    next();
});

const requireAuth = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.render('login', {
            message: 'Please login to continue',
            messageClass: 'alert-danger'
        });
    }
};

app.get('/whatsapp_', requireAuth, (req, res) => {
    if (req.user) {
        res.render('whatsapp_');
    } else {
        res.render('login', {
            message: 'Please login to continue',
            messageClass: 'alert-danger'
        });
    }
});

app.get('/logout', function(req, res){
    res.clearCookie('AuthToken');
    res.redirect('login');
});

// <==  BAGIAN WA API  ==>
// const db = require('./helpers/db.js');
// (async() => {
//     const savedSession = await db.readSession();
    const client = new Client({ 
        puppeteer: { 
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- this one doesn't works in Windows
                '--disable-gpu'
            ],
        },
        authStrategy: new NoAuth() 
        // authStrategy: new LegacySessionAuth({
        //     session: savedSession
        // })
    });

    client.on('message', msg => {
        if (msg.body == 'mad') {
            msg.reply('oee');
        }
    });
    
    client.initialize();

    // Socket IO
    io.on('connection', function(socket) {
        socket.emit('message', 'Connecting...');
    
        client.on('qr', (qr) => {
            console.log('QR RECEIVED', qr);
            qrcode.toDataURL(qr, (err, url) => {
                socket.emit('qr', url);
                socket.emit('message', 'QR Code received, scan please!');
            });
        });
    
        client.on('ready', () => {
            socket.emit('ready', 'Whatsapp is ready!');
            socket.emit('message', 'Whatsapp is ready!');
        });
    
        client.on('authenticated', (session) => {
            socket.emit('authenticated', 'Whatsapp is authenticated');
            socket.emit('message', 'Whatsapp is authenticated');
            console.log('AUTHENTICATED', session);
            // save session to db
            // db.saveSession(session);
        });
    
        client.on('auth_failure', function (session) { 
            console.log(session);
            socket.emit('message', 'Auth failure, restarting....');
        });
    
        client.on('disconnected', (reason) => { 
            socket.emit('message', 'Whatsapp is disconected!');
            // remove session from db
            // db.removeSession(); 
            client.destroy();
            client.initialize();
        });
    });
    
    // app.get('/AmbilStatus',async(req,res)=>{
    //     try {
    //         const sess = await db.readSession()
    //         if(!sess) return res.json("kosong");
    //             res.status(200).json({msg:"Tersambung"});
    //     } catch (error) {
    //         res.status(404).json({msg:"Tidak Tersambung"})
    //     }
    // })

    // Send message
    const checkRegisteredNumber = async function(number) {
        const isRegistered = await client.isRegisteredUser(number);
        return isRegistered;
    }

    app.post('/whatsapp_/send-message', [
        body('token').notEmpty(),
        body('number').notEmpty(),
        body('message').notEmpty(),
    ], async (req, res) => {
    
        const errors = validationResult(req).formatWith(({
            msg
        }) => {
            return msg;
        });
    
        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: false,
                message: errors.mapped()
            });
        }
    
        const token = "1RtUp4y54T4NgN1N4yh4c4yTn1s3v0lDuYs4mH4Y5D4Mh4"; // deklarasi token manual
        const get_token = req.body.token; // get token dari pesan
    
        if(get_token != token){
            return res.status(422).json({
                status: false,
                message: 'Token salah'
            });
        }else{
            const number = phoneNumberFormatter(req.body.number);
            const message = req.body.message;
    
            const isRegisteredNumber = await checkRegisteredNumber(number);
    
            if (!isRegisteredNumber) {
                return res.status(422).json({
                    status: false,
                    message: 'The number is not registered'
                });
            }
    
            client.sendMessage(number, message).then(response => {
                res.status(200).json({
                    status: true,
                    response: response
                });
            }).catch(err => {
                res.status(500).json({
                    status: false,
                    response: err
                });
            });
        }
    });
// })();

server.listen(port, function() {
    console.log('App running on *: ');
});