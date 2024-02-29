//-------------------MODULOS IMPORTADOS
import express from "express";
import morgan from "morgan";
import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import mqtt from "mqtt";
import path from 'path';
import fs from 'fs';
import { MongoClient } from "mongodb";
import expressFormData from 'express-form-data';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import twilio from 'twilio';
import bodyParser from 'body-parser';
const { MessagingResponse } = twilio.twiml;
dotenv.config();

const accountSid = 'AC1f7951850e183520a2e619cae814fb95'
const authToken = '75b02550c0f8189e3af4369b986f0120'
const myPhoneNumber = '+59176279020';

const client = twilio(accountSid, authToken);
/*
client.messages.create({
  to: myPhoneNumber,
  from: '+12018491392',
  body: 'Hello world'
})
  .then(message => console.log(message.sid))
  .catch(e => console.error(e)); // Añadido manejo de errores
*/

//--------------------------
// Umbrales para alertas
const umbrales = {
  temperatura: 30, // Grados Celsius
  humedad: 80, // Porcentaje
  pluviometro: 10, // Milímetros
  camara1: 50
};

// Datos actuales
let datosActuales = {
  tiempo: '',
  temperatura: 0,
  humedad: 0,
  pluviometro: 0,
  camara1: 0
};

//-----rutas-----------------------------------------------------
import indexRoutes from "./routes/index.js";
// ---------------------INCIALIZANDO EXstrePRESS------------------------------
const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
global.MENSAJE = 'valor';

//-----------------------------CONFIGURACIONES--------------------------------
app.set("port", process.env.PORT || 3000);
app.set("views", join(__dirname, "views"));
app.set("view engine", "ejs");

//----------------------------MIDDLEWARES-------------------------------------
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(expressFormData.parse({ keepExtension: true }));
app.use(fileUpload());
// Routes
app.use(indexRoutes);
// ---------------------------ARCHIVOS ESTATICOS------------------------------
app.use(express.static(join(__dirname, "public")));

// Middleware para analizar el cuerpo de las solicitudes entrantes
app.use(bodyParser.urlencoded({ extended: false }));


// ---------------------------CREAR UN SERVIDOR USSANDO HTTP-------------------
const server = http.createServer(app);

// ---------------------------Crear un servidor Socket.IO y adjuntarlo al servidor HTTP.-------
const io = new Server(server);

//----------------------------DETALLES A LA CONEXION DEL MONGODB----------------
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'monitoreoDB';
let db;
//----------------------------CONEXION A MONGODB-------------------------------
async function connectToMongo() {
  try {
    const client = await MongoClient.connect(mongoUrl);
    db = client.db(dbName);
    //Emitir los últimos 20 puntos de datos cuando la página se carga.
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}
// ---------------------------CONEXION AL BROKER MQTT-------------------------------------
const mqttClient = mqtt.connect("mqtt://localhost", {
  reconnectPeriod: 1000, // Reintentar la conexión cada 1000 ms
  connectTimeout: 30 * 1000 // Tiempo de espera para la conexión
});
mqttClient.on('connect', () => console.log('Cliente MQTT Conectado'));
mqttClient.on('reconnect', () => console.log('Cliente MQTT Reintentando Conexión'));
mqttClient.on('disconnect', () => console.log('Cliente MQTT Desconectado'));
mqttClient.on('error', error => console.error('Error en Cliente MQTT:', error));
  //----------------------------SUSUCRIPCION A TODOS LOS TOPICOS----------------------------
  const mqttTopics = [
    "monitoreo/tiempo",
    "monitoreo/Temperatura",
    "monitoreo/Temperatura2",
    "monitoreo/Humedad",
    "monitoreo/Humedad2",
    "monitoreo/Rain1",
    "monitoreo/Rain2",
    "monitoreo/camara1",
    "monitoreo/camara2",
    "motor/control/1",
    "motor/control/2"

  ];
  mqttClient.subscribe(mqttTopics);
  mqttClient.on("message", async (topic, message) => { // Marca esta función como async
    //console.log(topic);
      //---------------------------recibiendo mensajes-----------------------------
    console.log("mensaje crudo", message);
    const data = JSON.parse(message.toString());
    console.log("mensaje data ", data)
  
    //----------------------------Enviar datos al cliente basándose en el tema (topic).----
    switch (topic) {
      case 'monitoreo/Temperatura':
        datosActuales.temperatura = parseFloat(data.value);
  
        break;
      case 'monitoreo/Temperatura2':
        break;
      case 'monitoreo/Humedad':
        datosActuales.humedad = parseFloat(data.value);
        break;
      case 'monitoreo/Humedad2':
        break;
      case 'monitoreo/Rain1':
        datosActuales.pluviometro = parseFloat(data.value);
        break;
      case 'monitoreo/Rain2':
        break;
      case 'monitoreo/camara1':
        datosActuales.camara1 = parseFloat(data.value);
        break;
      case 'monitoreo/camara2':
        datosActuales.camara2 = parseFloat(data.value);
        break;
      case 'monitoreo/tiempo':
        datosActuales.tiempo = message.toString();
        break;
    }
  
    // Guardar en MongoDB
    try {
      await saveDataToMongoDB(topic, data.value); // Usa await aquí
    } catch (error) {
      console.error('Error al guardar en MongoDB:', error);
    }
      // Comprobar si se superan los umbrales
      if (datosActuales.temperatura > umbrales.temperatura ||
        datosActuales.humedad > umbrales.humedad ||
        datosActuales.pluviometro > umbrales.pluviometro ||
        datosActuales.camara1 > umbrales.camara1) {
        //enviarAlerta();
      }
    //console.log("VALORES POR TOPICO ",data.value);
  });
//------------------------seccion para verificar si existe alerta de inundacion----------
app.post('/sms', (req, res) => {
  const mensajeRecibido = req.body.Body;
  const numeroRemitente = req.body.From;

  console.log(`Mensaje recibido de ${numeroRemitente}: ${mensajeRecibido}`);

  // Dividir el mensaje en varios tópicos/valores si contiene múltiples mensajes
  const mensajes = mensajeRecibido.split(' ');
  mensajes.forEach(mensaje => {
    const partesMensaje = mensaje.split('/');
    if (partesMensaje.length === 3) {
      const topico = partesMensaje[0] + "/" + partesMensaje[1];
      const valor = partesMensaje[2];

      // Lista de tópicos válidos
      const topicosValidos = [
        "monitoreo/tiempo",
        "monitoreo/Temperatura",
        "monitoreo/Temperatura2",
        "monitoreo/Humedad",
        "monitoreo/Humedad2",
        "monitoreo/camara1",
        "monitoreo/camara2",
        "monitoreo/Rain1",
        "monitoreo/Rain2",
      ];

      // Verificar si el tópico es válido y publicar el valor
      if (topicosValidos.includes(topico)) {
        mqttClient.publish(topico, JSON.stringify({ value: valor }));
        //console.log(`Publicado en ${topico}: ${valor}`);
      }
    }
  });
});
//||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||


//------*****------------------------ Configurar un evento de conexión para Socket.IO---******----------
io.on("connection", (socket) => {
  console.log("A user connected");
  //----------------------Manejadores de eventos para actualizaciones de datos---------
  socket.on('getLatestDataByTopic', async (topic) => {
    const latestDataByTopic = await getLatestDataByTopic(topic, 15);
    socket.emit('latestDataByTopic', { topic, data: latestDataByTopic });
  });
  socket.on('requestUpdateAllData', async () => {
    try {
      const allData = await getAllData();
      console.log("Enviando datos: ", allData); // Añade esto para depuración
      socket.emit('allData', allData);
    } catch (error) {
      console.error('Error al obtener todos los datos:', error);
    }
  });
  socket.on("control-motor", (data) => {
    const topic = `motor/control/${data.motor}/${data.angle}`;
    const message = JSON.stringify({ angle: data.angle });
    // Publicar en MQTT datos de los motores -----------------------
    mqttClient.publish(topic, message, (err) => {
      if (err) {
        console.error('Error al publicar en MQTT:', err);
      } else {
        console.log('Mensaje publicado correctamente en', topic);
        // Envío de SMS con Twilio sobre el motor 
        sendSMS(topic);
      }
    });
  });
//DIRECCION PARA ARCHIVO DE DESCARAG CSV :
// En el lado del servidor, cuando el archivo CSV esté listo:
const csvDownloadUrl = ' https://a6d1-177-222-63-50.ngrok-free.app /archivo.csv'; // Reemplaza con la URL real
io.emit('csvDownloadUrl', csvDownloadUrl);

  //----------------------------CONFIGURARA UN EVENTO PARA MENSAJES DE MQTT------------
  mqttClient.on("message", async (topic, message) => { // Marca esta función como async
    //console.log(topic);
    const data = JSON.parse(message.toString());
    //----------------------------Enviar datos al cliente basándose en el tema (topic).----
    switch (topic) {
      case 'monitoreo/Temperatura':
        socket.emit("temperatura", data.value);
        break;
      case 'monitoreo/Temperatura2':
        socket.emit("temperatura2", data.value);
        break;
      case 'monitoreo/Humedad':
        socket.emit("humedad", data.value);
        break;
      case 'monitoreo/Humedad2':
        socket.emit("humedad2", data.value);
        break;
      case 'monitoreo/Rain1':
        socket.emit("Rain1", data.value);
        break;
      case 'monitoreo/Rain2':
        socket.emit("Rain2", data.value);
        break;
      case 'monitoreo/camara1':
        socket.emit("camara1", data.value);
        break;
      case 'monitoreo/camara2':
        socket.emit("camara2", data.value);
        break;
      case 'monitoreo/tiempo':
        socket.emit("tiempo", data.value);

        break;


    }
  });
  //--------------PARA DESCARGA DE ARCHIVOS -----------
  socket.on('requestCsvDownload', async () => {
    try {
      const allData = await getAllData();
      const csvFilePath = await generateCsv(db); // Pasa db aquí
      const csvFullPath = path.join(__dirname, 'csv_files', csvFilePath);

      // Envía el archivo al cliente
      socket.emit('csvFileReady', csvFilePath);
    } catch (error) {
      console.error('Error al generar el archivo CSV:', error);
    }
  });

  // ------------------------Set up a disconnect event---------------------------------------
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
  //app.use('/csv', express.static(join(__dirname, 'csv_files')));
app.get('/download-csv/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const directoryPath = path.join(__dirname, 'csv_files');
  const filePath = path.join(directoryPath, fileName);

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Error al descargar el archivo:', err);
    }
  });
});

});
//******************************************************************* */

//-----------$$$$$$$$$$$$$$$$$$$$$$$$$$$-TODAS LAS FUNCIONES DISPONIBLES-$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$----!!
//---------------------------FUNCIONES PARA MONGODB--------------------------------------
//obtener todos los datos 
async function getAllData() {
  try {
    if (!db) {
      console.error('Not connected to MongoDB');
      return [];
    }

    const collection = db.collection('datos');
    const topics = [
      "monitoreo/tiempo",
      "monitoreo/Temperatura",
      "monitoreo/Temperatura2",
      "monitoreo/Humedad",
      "monitoreo/Humedad2",
      "monitoreo/Rain1",
      "monitoreo/Rain2",
      "monitoreo/camara1",
      "monitoreo/camara2",
      "motor/control/1",
      "motor/control/2"
      // Agrega más tópicos si es necesario
    ];

    let organizedData = {};

    for (const topic of topics) {
      const data = await collection.find({ topic }).sort({ timestamp: -1 }).limit(10).toArray();
      data.forEach(item => {
        const timestamp = item.timestamp.toISOString().substring(0, 16).replace('T', ' ');
        if (!organizedData[timestamp]) {
          organizedData[timestamp] = { timestamp };
        }
        if (!organizedData[timestamp][topic]) {
          organizedData[timestamp][topic] = [];
        }
        organizedData[timestamp][topic].push(item.value);
      });
    }

    return Object.values(organizedData);
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    return [];
  }
}


//--------obtener los ultimos datos por topico 
async function getLatestDataByTopic(topic, limit) {
  try {
    if (!db) {
      console.error('Not connected to MongoDB');
      return [];
    }

    const collection = db.collection('datos');
    let data = await collection.find({ topic: topic }).sort({ timestamp: -1 }).limit(limit).toArray();

    // Formatear cada timestamp
    data = data.map(item => {
      // Asumiendo que 'timestamp' es un objeto de tipo Date o una cadena ISO 8601
      item.timestamp = formatDate(item.timestamp);
      return item;
    });

    return data.reverse();
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    return [];
  }
}
function formatDate(date) {
  // Crear un objeto Date si 'date' no lo es
  const d = new Date(date);

  // Formatear la fecha y hora en el formato "YYYY-MM-DD HH:mm"
  return d.toISOString().substring(0, 16).replace('T', ' ');
}
//----------------------PROCESASAR DATOS PARA CSV --------------------------------------------
function processDataForCsv(rawData) {
  // Organiza los datos por timestamp
  let organizedData = {};
  rawData.forEach(item => {
    const timestamp = item.timestamp.toISOString().substring(0, 16).replace('T', ' ');
    if (!organizedData[timestamp]) {
      organizedData[timestamp] = { timestamp };
    }
    organizedData[timestamp][item.topic] = item.value;
  });

  // Convertir los datos organizados en un array para el CSV
  let csvData = [];
  for (const timestamp in organizedData) {
    let row = organizedData[timestamp];
    csvData.push(row);
  }
  console.log('Datos procesados para CSV:', csvData); // Agrega esto para depuración
  return csvData;
}

//crear un csv 
async function generateCsv(db) {
  try {
    // Asegúrate de que el directorio para guardar los archivos CSV exista
    const csvDir = path.join(__dirname, 'csv_files');
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }

    // Nombre y ruta del archivo CSV
    const csvFileName = `data-${Date.now()}.csv`;
    const csvFilePath = path.join(csvDir, csvFileName);

    // Consultar los datos de MongoDB
    const collection = db.collection('datos');
    let rawData = await collection.find({}).sort({ timestamp: -1 }).toArray();

    // Procesar los datos para el formato CSV-***
    let processedData = processDataForCsv(rawData);
    console.log('Datos a escribir en CSV:', processedData); // Agrega esto para depuración

    // Crear el CSV****
    const writer = createCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'monitoreo/Tiempo', title: 'TIEMPO' },
        { id: 'monitoreo/Temperatura', title: 'TEMPERATURA RIO LA PAZ' },
        { id: 'monitoreo/Temperatura2', title: 'TEMPERATURA2' },
        { id: 'monitoreo/Humedad', title: 'HUMEDAD RIO LA PAZ' },
        { id: 'monitoreo/Humedad2', title: 'HUMEDAD2' },
        { id: 'monitoreo/Rain1', title: 'PLUVIOMETRO RIO LA PAZ' },
        { id: 'monitoreo/Rain2', title: 'PLUVIOMETRO2' },
        // Agrega más columnas si es necesario
      ],
    });

    // Transformar los datos para el formato del CSV******
    const csvData = [];
    processedData.forEach(item => {
      const maxValuesLength = Math.max(...Object.values(item).map(val => Array.isArray(val) ? val.length : 0));
      for (let i = 0; i < maxValuesLength; i++) {
        let record = { timestamp: item.timestamp };
        Object.keys(item).forEach(key => {
          if (key !== 'timestamp') {
            record[key] = item[key][i] || 'N/A'; // Usa 'N/A' si no hay valor
          }
        });
        csvData.push(record);
      }
    });

    await writer.writeRecords(processedData);
    console.log('Archivo CSV generado:', csvFileName); // Agrega esto para depuración
    return csvFileName;
  } catch (error) {
    console.error('Error al crear el archivo CSV:', error);
    throw error;
  }
}

// Función para enviar SMS
function sendSMS(topic) {
  client.messages.create({
    to: myPhoneNumber,
    from: '+13235315838',
    body: topic
  })
    .then(message => console.log(topic))
    .catch(e => console.error(e));
}
//funcion para guardar los datos en mongo 
async function saveDataToMongoDB(topic, data) {
  if (!db) {
    console.error('No se puede guardar en MongoDB, no hay conexión');
    return;
  }

  const collection = db.collection('datos');
  const document = {
    topic,
    value: JSON.stringify(data),
    timestamp: new Date()
  };

  const key = { topic, timestamp: document.timestamp };

  try {
    const result = await collection.updateOne(key, { $set: document }, { upsert: true });
    //console.log('Datos insertados o actualizados en MongoDB:', result.upsertedId || key);
  } catch (err) {
    console.error('Error al insertar o actualizar datos en MongoDB:', err);
  }
}

function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${formattedHours}:${formattedMinutes}`;
}
//---------FUNCION PARA ENVIAR ALERTA 
function enviarAlerta() {
  const mensaje = `🚨 ¡PLUVIA registra Alerta de Inundación! 🚨

  Nuestros sensores indican condiciones de inundación. Por favor, tome medidas de seguridad inmediatas.

  Datos Recientes de Nuestro equipo principal:
  ⏰ Tiempo: ${datosActuales.tiempo}
  🌡️ Temperatura Río La Paz: ${datosActuales.temperatura} °C
  💧 Humedad Río La Paz: ${datosActuales.humedad} %
  ☔ Pluviómetro Río La Paz: ${datosActuales.pluviometro} mm
  ☔ Nivel de agua Río La Paz: Alto riesgo 

  Acciones Recomendadas para el ciudadano:
  1. Evacúe la zona y busque refugio más alto.
  2. Siga las instrucciones de las autoridades locales.

  ¡Manténgase a salvo!`;

  client.messages
    .create({
      body: mensaje,
      from: '+13235315838',
      to: '+59176279020'
    })
    .then(message => console.log(message.sid))
    .catch(e => console.error(e));
  console.log(mensaje)
}
//--------------------------
connectToMongo();
// Start the server
server.listen(app.get("port"), () => {
  console.log("Server on port", app.get("port"));
});
