const config = require('./config');
const app = require('./app');

app.listen(config.puerto, () => {
  console.log(`Salud en mi Vereda escuchando en http://localhost:${config.puerto}`);
});
