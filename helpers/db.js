const { Client } = require('pg');

const client = new Client({
    // connectionString: "postgres://jszocqisvktqcm:650876e97d3ac439cbb51a8baa3c2670f776a523517ffda4be3ae85448f2fa8e@ec2-3-217-251-77.compute-1.amazonaws.com:5432/d9ubue1vaoqanu",
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect();

const readSession = async () => {
    try {
        const res = await client.query('SELECT * FROM wa_session ORDER BY created_at DESC LIMIT 1');
        if (res.rows.length) return res.rows[0].session;
        return '';
    } catch (err) {
        throw err;
    }
}

const saveSession = (session) => {
    client.query('INSERT INTO wa_session (session) VALUES($1)', [session], (err, result) => {
        if (err) {
            console.error('Failed to save session !', err);
        } else {
            console.log('Session saved !');
        }
    });
}

const removeSession = () => {
    client.query('DELETE FROM wa_session', (err, result) => {
        if (err) {
            console.error('Failed to remove session !', err);
        } else {
            console.log('Session deleted !');
        }
    });
}

module.exports = {
    readSession,
    saveSession,
    removeSession
}