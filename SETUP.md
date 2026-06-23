# RugbyLab v3.1 — Setup Guide

## 1. Instalar dependencias
```bash
cd rl
npm install
npm run dev
```

## 2. Firebase Storage CORS (para subir fotos)
Una sola vez desde Google Cloud Shell (console.cloud.google.com):
```bash
cat > cors.json << 'CORS'
[{"origin":["*"],"method":["GET","HEAD","PUT","POST","DELETE"],"responseHeader":["Content-Type","Authorization","X-Requested-With"],"maxAgeSeconds":3600}]
CORS
gcloud storage buckets update gs://NOMBRE_DEL_BUCKET --cors-file=cors.json
```
Para ver el nombre del bucket: Firebase Console → Storage

## 3. Firestore Rules (para pizarra táctica)
Firebase Console → Firestore → Reglas → Pegar el contenido de `firestore.rules`

## 4. Storage Rules
Firebase Console → Storage → Reglas → Pegar el contenido de `storage.rules`

## 5. Funcionalidades disponibles

### 📊 Exportar Excel
- Plantel: botón "📊 Excel" en toolbar
- Gimnasio: botón "📊 Excel" junto a la rutina activa
- Médico: botón "📊 Excel" en toolbar
- Nutrición: botón en plan activo

### 📄 Exportar PDF
- Estadísticas: botón "📄 PDF" junto al partido seleccionado
- Logística: botón "📄 Exportar PDF" en la barra superior

### 📷 Escanear con IA
- Gimnasio: botón "📷 Escanear plan" → subir foto de rutina
- Nutrición: botón "📷 Escanear comida" → subir foto de plato/etiqueta
- Claude Vision extrae automáticamente los datos

### PWA (instalable como app)
- iOS: Safari → Compartir → "Agregar a pantalla de inicio"
- Android: Chrome → Menú → "Instalar app"
- Los iconos están en public/icon-192.png y icon-512.png
