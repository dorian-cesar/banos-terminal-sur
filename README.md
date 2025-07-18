# pullman-modulo-caja

boleto sin usar: 7808158057
boleto usado: 7928708795


npm install pm2 -g
pm2 start server.js
pm2 save


Opción 1: Crear acceso directo al inicio de Windows (más simple)
Abre la terminal y corre:


pm2 start server.js
pm2 save
Presiona Win + R, escribe:

shell:startup
Se abrirá la carpeta de inicio automático de Windows.

Dentro de esa carpeta, crea un acceso directo con este comando como destino:

C:\Users\PC\AppData\Roaming\npm\pm2.cmd resurrect

(Asegúrate de que pm2.cmd esté en esa ruta. Si no, revisa con where pm2 o where pm2.cmd.)

Nombra el acceso directo como "Arranque PM2".


Lanzar el frontend en pantalla completa con Chrome/Edge en modo kiosk
Usar archivo .bat con delay
Crea un archivo llamado, por ejemplo:
abrir-kiosko.bat con este contenido:

timeout /t 10 >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://localhost:8080

Copia ese .bat dentro de la carpeta shell:startup.