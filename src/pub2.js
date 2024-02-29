import mqtt from "mqtt"; 
import { MongoClient } from "mongodb";
import Jimp from "jimp";
// URL de conexión a MongoDB (asegúrate de cambiarla según tu configuración)
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'monitoreoDB';

class DataPublisher {
  constructor() {
    this.mqttClient = mqtt.connect('mqtt://localhost');
    this.mongoDb = null;
  }

  async connect() {
    await this.mqttConnect();
    await this.mongoConnect();
  }

  async mqttConnect() {
    return new Promise((resolve) => {
      this.mqttClient.on('connect', () => {
        console.log('Conectado al broker MQTT');
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        console.error('Error en la conexión MQTT:', error);
        process.exit(1);
      });
    });
  }

  async mongoConnect() {
    if (this.mongoDb) {
      console.log('Ya está conectado a MongoDB');
      return;
    }

    try {
      const client = await MongoClient.connect(mongoUrl);
      this.mongoDb = client.db(dbName);
      console.log('Conectado a MongoDB');
    } catch (err) {
      console.error('Error en la conexión a MongoDB:', err);
      process.exit(1);
    }
  }

  async publishAndSaveData(topic, data) {
    const message = JSON.stringify({ value: data });

    this.mqttClient.publish(topic, message, () => {
      console.log(`Mensaje publicado en el tópico ${topic}: ${message}`);
      this.saveDataToMongoDB(topic, data);
    });
  }

  async saveDataToMongoDB(topic, data) {
    if (!this.mongoDb) {
      console.error('No se puede guardar en MongoDB, no hay conexión');
      return;
    }
  
    const collection = this.mongoDb.collection('datos');
    const document = {
      topic,
      value: data,
      timestamp: new Date()
    };
  
    // Añadir el tópico como parte de la clave para permitir búsquedas eficientes
    const key = { topic, timestamp: document.timestamp };
    
    // Reemplazar el documento existente o insertar uno nuevo
    collection.updateOne(key, { $set: document }, { upsert: true }, (err, result) => {
      if (err) {
        console.error('Error al insertar o actualizar datos en MongoDB:', err);
        return;
      }
  
      console.log('Datos insertados o actualizados en MongoDB:', result.upsertedId || key);
    });
  }

  async publishImageToTopic(topic, imagePath) {
    try {
      // Leer la imagen y ajustar su tamaño a 300x200 píxeles
      const image = await Jimp.read(imagePath);
      image.resize(300, 200);
      const imageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

      // Publicar la imagen en el tópico MQTT
      this.mqttClient.publish(topic, imageBuffer, { qos: 1 }, () => {
        console.log(`Imagen publicada en el tópico ${topic}: ${imagePath}`);
      });
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
    }
  }    
}
//----------------------------------------fin clase-------------
async function start() {
  const dataPublisher = new DataPublisher();
  await dataPublisher.connect();


  // Publicar un mensaje en un tópico cada 5 segundos
  const imagePath = './public/publiced/IMG_20201225_153822.jpg';
  const mqttTopic = 'monitoreo/Imagen';
  setInterval(() => {
    const temperatura = getRandomTemperature();
    const humedad = getRandomHumidity();
    const tiempo = getCurrentTime();


    dataPublisher.publishImageToTopic(mqttTopic, imagePath);
    // Publicar datos de temperatura
    dataPublisher.publishAndSaveData('monitoreo/Temperatura', temperatura);

    // Publicar datos de humedad
    dataPublisher.publishAndSaveData('monitoreo/Humedad', humedad);

    // Publicar datos de tiempo
    dataPublisher.publishAndSaveData('monitoreo/Tiempo', tiempo);

    // EQUIPO 2
    dataPublisher.publishAndSaveData('monitoreo/Temperatura2',humedad);

    // Publicar datos de humedad
    dataPublisher.publishAndSaveData('monitoreo/Humedad2', humedad);
    // EQUIPO 2
    dataPublisher.publishAndSaveData('monitoreo/Rain1',temperatura);

    // Publicar datos de humedad
    dataPublisher.publishAndSaveData('monitoreo/Rain2',humedad);
  }, 5000);
}

function getRandomTemperature() {
  // Ajustando el rango de temperatura a 15°C - 20°C
  const minTemp = 15;
  const maxTemp = 20;
  return Math.floor(Math.random() * (maxTemp - minTemp + 1)) + minTemp;
}

function getRandomHumidity() {
  // Ajustando el rango de humedad a 40% - 50%
  const minHumidity = 40;
  const maxHumidity = 50;
  return Math.floor(Math.random() * (maxHumidity - minHumidity + 1)) + minHumidity;
}
  

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${formattedHours}:${formattedMinutes}`;
}

start();
