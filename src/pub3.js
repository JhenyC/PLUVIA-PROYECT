import mqtt from 'mqtt';

class DataPublisher {
  constructor() {
    // Asegúrate de reemplazar estos valores con los correctos proporcionados por EMQX Cloud
    const options = {
      host: 'broker.emqx.io', // Reemplaza con tu host EMQX
      // Si necesitas configurar puerto y protocolo, añádelos aquí
    };
    this.mqttClient = mqtt.connect(options);
  }

  async connect() {
    return new Promise((resolve) => {
      this.mqttClient.on('connect', () => {
        console.log('Conectado al broker MQTT de EMQX');
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        console.error('Error en la conexión MQTT:', error);
        process.exit(1);
      });
    });
  }

  publishData(topic, data) {
    const message = JSON.stringify({ value: data });
    this.mqttClient.publish(topic, message, () => {
      console.log(`Mensaje publicado en el tópico ${topic}: ${message}`);
    });
  }
}

// Funciones para generar datos
function getRandomTemperature() {
  return Math.floor(Math.random() * 11) + 20;
}

function getRandomHumidity() {
  return Math.floor(Math.random() * 21) + 20;
}

function getCurrentTime() {
  const now = new Date();
  return `${now.getHours()}:${now.getMinutes()}`;
}

// Función para iniciar la publicación de datos
async function start() {
  const dataPublisher = new DataPublisher();
  await dataPublisher.connect();

  const topics = {
    'monitoreo/Temperatura': getRandomTemperature,
    'monitoreo/Humedad': getRandomHumidity,
    'monitoreo/Tiempo': getCurrentTime,
    'monitoreo/Temperatura2': getRandomTemperature,
    'monitoreo/Humedad2': getRandomHumidity,
    'monitoreo/Rain1': getRandomTemperature,
    'monitoreo/Rain2': getRandomHumidity,
    'monitoreo/camara1': getRandomTemperature,
    'monitoreo/camara2': getRandomHumidity
  };

  setInterval(() => {
    for (const [topic, dataFunction] of Object.entries(topics)) {
      dataPublisher.publishData(topic, dataFunction());
    }
  }, 10000);
}

start();
