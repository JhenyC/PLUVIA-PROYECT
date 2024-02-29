import { Router } from "express";

const router = Router();



// Rutas
router.get("/", (req, res) => {
  res.render("index", { title: "WELCOME PLUVIA" });
});

router.get("/about", (req, res) => {
  res.render("about", { title: "About Pluvia" });
});

router.get("/contact", (req, res) => {
  res.render("contact", { title: "Contact Page" });
});

router.get("/monitoring", (req, res) => {
  res.render("monitoring", { title: "Content Monitoring" });
});

router.get("/table", (req, res) => {
  res.render("table", { title: "Content Table" });
});

router.get("/tabledt", (req, res) => {
  res.render("tabledt", { title: "Content Tabledt" });
});

router.get("/streaming", (req, res) => {
  res.render("streaming", { title: "Content Streaming" });
});

router.get("/rec", (req, res) => {
  //res.render("received", { title: "Content Streaming" });
  res.send("hola que tal desde mi pagian web");
});

router.post('/rec', (req, res) => {
  // Asumiendo que los datos enviados desde Arduino son JSON
  const data1 = req.body.data1;
  const data2 = req.body.data2;

  console.log('Data1:', data1);
  console.log('Data2:', data2);

  // Aquí puedes procesar los datos como necesites

  // Envía una respuesta al Arduino
  res.status(200).send('Datos recibidos');
});

export default router;
