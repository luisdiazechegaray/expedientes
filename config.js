// Datos de la aplicación registrada en Microsoft (se rellenan una vez, al registrarla).
// No llevan datos de clientes: solo dicen a Microsoft qué aplicación pide permiso.
window.CONFIG = {
  clientId: "009b9761-ab02-450e-9cfd-cfc9a9992df7",                                   // Id. de la aplicación en Microsoft
  authority: "https://login.microsoftonline.com/consumers", // cuentas personales (OneDrive Personal)
  scopes: ["Files.Read"],                                   // solo leer los archivos de tu OneDrive
  rutaBase: "Gestor movil/gestor-movil.db",                 // dónde deja el gestor la copia
};
