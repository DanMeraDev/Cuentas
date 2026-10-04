# Gestor Financiero: plan

App web para que dos personas que viven juntas registren lo que gastan, el arriendo, los aportes que reciben de su familia, los servicios básicos y las deudas entre ellas. Cada registro guarda su prueba (captura o foto).

**Problema que resuelve:** no hay un registro común de quién pagó qué, quién recibió qué y cuándo, y eso termina en discusiones. La app es la única fuente de verdad, y registrar algo tiene que tomar menos de 10 segundos.

**No es un SaaS:** es para una sola casa. Aun así, **nada va escrito en el código** (nombres, montos, aportantes, servicios, reparto). Todo se carga desde la pantalla de Ajustes y un asistente de configuración inicial, para poder cambiarlo cuando haga falta.

---

## 1. Conceptos base

| Concepto | Qué es | Ejemplos (configurables) |
|---|---|---|
| **Miembros** | Las personas de la casa, cada una con su login | Persona A, Persona B |
| **Aportantes** | Quienes dan plata desde fuera | Mamá, Papá, inquilino del garaje |
| **Aportes recurrentes** | Plata que llega cada cierto tiempo, con monto, frecuencia y destino | Mamá $250/mes para arriendo; Mamá $90/semana; Papá $100/mes para servicios; garaje $40/mes |
| **Bolsas** | Fondos con un fin. Entra plata, sale plata y el sobrante se acumula | Arriendo del mes, Comida, Servicios |
| **Custodio** | Quién tiene físicamente la plata de una bolsa en este momento | "Los $250 de la mamá los tiene A" |
| **Obligaciones** | Pagos periódicos con fecha | Arriendo, luz, agua, gas, internet |
| **Balance entre miembros** | Lo que uno le debe al otro, calculado solo | "B le debe $37.50 a A" |

La clave del diseño es el **custodio**: la app siempre sabe **en manos de quién está cada dólar** y para qué es. Con eso calcula sola quién le tiene que pasar plata a quién.

## 2. Usuarios y privacidad

- Dos cuentas con login propio. Nombres y correos se cargan en la configuración inicial.
- **Gastos e ingresos personales**: los ve solo su dueño.
- **Lo de la casa** (arriendo, bolsas, servicios, gastos compartidos, deudas): lo ven los dos.
- Cada registro queda firmado con quién lo creó y cuándo.

## 3. Formas de registrar

1. **Con imagen (la principal):** captura de transferencia bancaria, Uber / Uber Eats, foto de una factura física, planilla de luz, etc.
   - La IA (OpenAI con visión) extrae: monto, fecha de la operación, comercio o destinatario, concepto y categoría sugerida. También sugiere el tipo de registro (por ejemplo, una planilla de luz va al servicio Luz).
   - Pantalla de confirmación con todo editable antes de guardar.
   - La imagen queda guardada como prueba.
   - Si se sube una imagen repetida, la app avisa.
2. **Manual, sin imagen:** "$2, le presté para un taxi". Opcional: escribirlo en texto libre y que la IA lo interprete.

**Fecha:** se usa la de la imagen. Si no tiene, la de subida. Siempre editable.

## 4. Módulos

### 4.1 Aportes recibidos (checks)

Cada aporte recurrente genera su registro por período (semana o mes) con un **check de "recibido"**:

- Cualquiera de los dos lo marca y elige **quién lo recibió**.
- Una vez marcado queda **bloqueado para ambos**, para que nadie lo registre dos veces. Solo quien lo marcó puede deshacerlo.
- El monto viene precargado y se puede editar si ese período fue distinto.
- Un aporte puede **repartirse en varios destinos**.

Ejemplo, el aporte semanal de la mamá ($90):

| Parte | Monto | Destino |
|---|---|---|
| Para A | $25 | Personal de A |
| Para B | $25 | Personal de B |
| Comida | $40 | Bolsa de comida (predeterminado; editable cada semana) |

Si los $90 los recibe A, la app registra sola que A tiene $25 que son de B (B lo ve como "A te debe $25") y que A es custodio de los $40 de comida.

Otros aportes del ejemplo actual:
- Mamá: $250/mes, destino bolsa de arriendo. Lo recibe uno u otro, según el mes.
- Papá: $100/mes, destino bolsa de servicios.
- Garaje: $40/mes, destino bolsa de arriendo. **Lo recibe siempre B, a mitad de mes** (receptor predeterminado configurable).

### 4.2 Arriendo mensual

Cada mes se crea una **bolsa de arriendo** con su meta ($550 en la configuración actual). Se ve así:

| Línea | Monto | Estado | Custodio |
|---|---|---|---|
| Aporte mamá | $250 | ✅ recibido | A |
| Garaje | $40 | ✅ recibido (día 15) | B |
| Parte de A | $150 | 🟡 apartada | A |
| Parte de B | $110 | ⏳ pendiente | — |
| **Pago al dueño** | **$550** | ⏳ | lo suele pagar B |

Comprobación: 250 + 40 + 150 + 110 = 550. El garaje va como línea propia y **no** se resta del monto del arriendo.

**Estados de la parte de cada miembro:**
- ⏳ **Pendiente.**
- 🟡 **Apartada:** botón "Ya tengo mi parte". Queda registrado con fecha y se avisa al otro.
- ✅ **Entregada:** se la pasó a quien paga al dueño.

**Mensaje de estado del arriendo** (en la tarjeta y en las notificaciones), según cómo vaya el mes:
- "A ya tiene su parte. Falta la tuya y pagar el arriendo."
- "Ya están las dos partes. Solo falta pagar el arriendo."
- "Falta el aporte de la mamá y el garaje." (si todavía no se marcaron como recibidos)
- "Arriendo de octubre pagado ✅."

**Garaje:** cuando lo cobra, B marca "Garaje cobrado". Desde ese momento B queda como custodio de esos $40.

**Al pagar al dueño:** quien paga marca el check (con captura) y la app calcula cuánto le debe pasar cada custodio. Por ejemplo, si paga B y A tiene los $250 de la mamá más sus $150, aparece "A le debe $400 a B".

**Plata en custodia que se gasta** (por ejemplo, B se gasta los $40 del garaje antes de fin de mes):
1. La app pide registrar **en qué se gastó** (con captura si la hay).
2. **Si fue personal:** tiene que reponerlo. Queda como deuda de B con la bolsa de arriendo hasta que lo devuelva.
3. **Si fue para la casa:** se acepta como gasto de la casa y **el faltante del arriendo se divide 50/50** entre los dos.

Esta regla vale para **cualquier bolsa** (arriendo, comida o servicios), no solo para el garaje.

**Recordatorios:** "faltan X días para pagar el arriendo y falta la parte de B".

### 4.3 Bolsas de comida y servicios

- **Comida:** entran los $40 semanales de la mamá (editable). Salen el súper y la comida "de la casa".
- **Servicios:** entran los $100 mensuales del papá. Salen luz, agua, gas e internet.
- **El sobrante se acumula** de un período a otro.
- **Mover sobrante entre bolsas:** por ejemplo, de servicios a la comida de este mes o del siguiente. Queda registrado.
- Se pueden crear más bolsas desde Ajustes.

### 4.4 Servicios básicos

Cada servicio se configura con:
- Nombre y bolsa de la que se paga (servicios).
- Quién pagó: normalmente A, que sube la captura del pago, pero puede ser cualquiera de los dos.
- **Monto variable:** no hay precio fijo; se registra lo que llegó cada mes, idealmente con la captura de la planilla o del pago.
- Frecuencia mensual, con un check de "pagado" por mes y quién pagó.
- **Opción "se puede acumular"** (internet): si un mes no se paga, queda pendiente y se avisa: "Internet: debes septiembre y octubre, acuérdate de pagar los dos". Al pagar se marca qué meses cubre ese pago.
- Luz, agua y gas: no se pueden acumular. Si quedan sin pagar, aparecen como atrasados.

**Saldo de la bolsa de servicios:**
- **Saldo real:** lo que hay hoy (lo que entró menos lo que se pagó).
- **Saldo comprometido:** lo reservado para servicios pendientes, como el internet que no se pagó este mes. Se estima con el último monto pagado.
- **Sobrante disponible:** saldo real menos comprometido. Es lo único que se puede mover a otra bolsa, para no gastar la plata del internet atrasado.

### 4.5 Gastos

Al registrar un gasto se elige **de dónde sale**:

1. **Personal:** lo ve solo su dueño.
2. **Compartido:** se divide entre los dos, **50/50 por defecto**, editable por porcentaje o por monto.
3. **De una bolsa:** "la pizza la pagamos de la comida". Se descuenta de la bolsa y nadie le debe nada a nadie.

Categorías sugeridas por la IA (editables): comida/súper, delivery, transporte, servicios, casa, salud, ocio, otros.

### 4.6 Deudas y balance entre miembros

- **Deudas manuales:** "B le debe a A $40, compra del súper". Con fecha, concepto y prueba opcional.
- **Deudas automáticas** que salen de los demás módulos: aportes recibidos por el otro, partes del arriendo, gastos compartidos, reposiciones de bolsas.
- **Abonos parciales** hasta saldar, cada uno con su captura opcional.
- **Balance único** en la pantalla principal: "B te debe $87.50". Al tocarlo se ve el detalle línea por línea.
- **"Saldar":** registra la transferencia (con captura) y deja el balance en cero.

### 4.7 Finanzas personales

- Cada uno ve sus gastos personales y sus ingresos personales (por ejemplo, los $25 semanales de la mamá, o un sueldo si quiere registrarlo).
- Resumen: "este mes recibí X, gasté Y, me queda Z". Es opcional usarlo.

### 4.8 Notificaciones

- **Centro de avisos dentro de la app** (campanita).
- **Notificaciones push en el iPhone:** funcionan si la web se instala en la pantalla de inicio (iOS 16.4 o más nuevo).
- Avisos previstos:
  - "A marcó que recibió el aporte de la mamá."
  - "A ya tiene su parte del arriendo, falta la tuya."
  - "Tienes $40 del garaje en custodia; el arriendo se paga en X días."
  - "Internet lleva 1 mes sin pagar."
  - "B registró un gasto compartido de $12."

### 4.9 Resumen mensual

- Estado del arriendo, saldo de cada bolsa, servicios pagados y pendientes, balance entre los dos y gastos de la casa por categoría.

## 5. Configuración inicial (asistente)

La primera vez que se entra a la app:
1. Crear la casa y los dos miembros (nombres y correos).
2. Agregar aportantes y sus aportes recurrentes (monto, frecuencia, destino, receptor predeterminado).
3. Configurar el arriendo: meta mensual, parte de cada miembro, quién paga normalmente y día de pago.
4. Crear las bolsas.
5. Agregar los servicios (bolsa de la que se pagan y si se pueden acumular).

Todo esto se puede cambiar después desde Ajustes. Los cambios aplican **del período siguiente en adelante**, sin tocar el historial.

## 6. Tecnología

- **Next.js**, como web instalable en iPhone (PWA: "Añadir a pantalla de inicio"). No requiere App Store.
- **Supabase**: base de datos Postgres, login, almacenamiento de imágenes y reglas de privacidad a nivel de base de datos.
- **Vercel**: hosting gratis, con lógica de servidor y tareas programadas para generar los registros de cada período y los recordatorios.
- **OpenAI**: modelo con visión económico y respuesta en JSON estructurado.
- Plan B de hosting: Raspberry Pi con Docker.

**Lo que hará falta del usuario, en su momento:** proyecto de Supabase (URL, anon key, service role key), API key de OpenAI y cuenta de Vercel. Las claves van en un archivo `.env.local` que llena el usuario, no pegadas en el chat.

## 7. Fases

**Fase 1: el corazón**
- Login, asistente de configuración y Ajustes.
- Registro con imagen + IA y registro manual.
- Aportes con check bloqueable y receptor.
- Bolsas con custodio, sobrante acumulado y movimientos entre bolsas.
- Plata en custodia que se gastó (personal: reponer; casa: dividir).
- Arriendo mensual con estados (pendiente, apartada, entregada) y pago al dueño.
- Servicios con monto variable y meses acumulables.
- Gastos personales, compartidos y de bolsa.
- Deudas manuales y automáticas, abonos y balance.
- Centro de avisos dentro de la app.
- Historial con filtros y la prueba de cada registro.
- Atajo de iPhone para registrar desde el menú Compartir.

**Fase 2**
- Notificaciones push en el iPhone.
- Resúmenes y gráficos mensuales.
- Aprobar o cuestionar un gasto compartido registrado por el otro.

**Fase 3**
- Presupuesto por categoría.
- Exportar a Excel.

## 8. Decisiones cerradas

- **Formato:** web instalable (PWA) con aspecto de app móvil. Sin App Store. Si algún día se paga la cuenta de Apple ($99/año), se puede envolver como app nativa.
- **Atajo de iPhone** ("Registrar gasto" desde el menú Compartir de una captura): entra en la Fase 1 porque es lo que hace que la usen a diario.
- **Faltante en una bolsa** (por ejemplo, servicios por encima de los $100 más el sobrante): la app avisa y en ese momento se elige cómo cubrirlo: **desde otra bolsa** (normalmente comida) o **50/50** entre los dos.
- **Servicios:** normalmente los paga A subiendo la captura, pero puede pagarlos cualquiera.

## 9. Estado (4 oct 2026)

**Fase 1 construida y probada en local:**
- Login, invitación y asistente de configuración.
- Aportes con check bloqueable, bolsas con custodio, arriendo (apartar, entregar, pagar), servicios con meses acumulables y reserva.
- Gastos personales, compartidos y de bolsa; deudas, abonos y «quedamos a mano».
- Faltantes (cubrir con otra bolsa o 50/50), avisos dentro de la app, historial con comprobantes y deshacer.
- Registro con captura + IA, registro a mano con texto libre, y API para el atajo de iPhone.

**En producción:** https://cuentas-casa-silk.vercel.app (Vercel + Supabase en us-east-1). Cada push a `main` se despliega solo.

**Siguiente (Fase 2):** notificaciones push en el iPhone, resúmenes y gráficos mensuales, aprobar o cuestionar gastos compartidos.
