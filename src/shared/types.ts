export type Role='admin'|'cuerpo_tecnico'|'jugador'
export interface Player{id:string;name:string;position:string;positions?:string[];number:number;role:Role;status:'Disponible'|'Lesionado'|'Duda'|'Suspendido';avatarUrl?:string;birthDate?:string;weight?:number;height?:number;notes?:string;clubId:string}
export interface Evento{id:string;clubId:string;titulo:string;tipo:'partido'|'entrenamiento'|'concentracion'|'medico'|'otro';fecha:string;horaInicio?:string;lugar?:string;rival?:string;obligatorio:boolean;createdBy:string}
export interface Match{id:string;clubId:string;rival:string;fecha:string;cancha:string;competicion:string;teamStats:any;playerStats:any[];createdBy:string}
export interface Lesion{id:string;playerId:string;playerName:string;clubId:string;zona:string;descripcion:string;fechaLesion:string;estado:'activa'|'en_recuperacion'|'alta_medica';createdBy:string}

export type BlockType = 'entrada_calor'|'principal'|'circuito'|'skills'|'vuelta_calma'
export interface SetDetail { reps:number; weight:number|null }
export interface Exercise { name:string; sets:number; reps:number; weight:number|null; unit:string; notes:string|null; setDetails:SetDetail[]|null }
export interface ExerciseBlock { blockType:BlockType; exercises:Exercise[]; circuitRounds:number|null; circuitRestSecs:number|null }
export interface RoutineDay { day:string; type:string; blocks:ExerciseBlock[]; completed:boolean; completedAt:any }
export interface Routine { id:string; playerId:string; clubId:string; week:number; year:number; days:RoutineDay[]; createdBy:string }
export interface MealItem { name:string; quantity:string; calories:number; protein:number; carbs:number; fat:number }
export interface Meal { type:string; items:MealItem[] }
export interface NutritionPlan { id:string; playerId:string; clubId:string; meals:Meal[]; targetCalories:number; targetProtein:number; targetCarbs:number; targetFat:number; createdBy:string }
export interface Video { id:string; title:string; description?:string; url:string; thumbnailUrl?:string; position:string[]; category:string; clubId:string }
export interface Message { id:string; authorId:string; authorName:string; body:string; clubId:string; createdAt:any }
export type LesionEstado = 'activa'|'en_recuperacion'|'alta_medica'
export type LesionZona = 'cabeza'|'cuello'|'hombro_der'|'hombro_izq'|'codo_der'|'codo_izq'|'muneca_der'|'muneca_izq'|'espalda_alta'|'espalda_baja'|'cadera'|'muslo_der'|'muslo_izq'|'rodilla_der'|'rodilla_izq'|'tobillo_der'|'tobillo_izq'|'otro'
export interface Lesion { id:string; playerId:string; playerName:string; clubId:string; zona:LesionZona; descripcion:string; fechaLesion:string; fechaAltaEstimada:string|null; fechaAltaReal:string|null; estado:LesionEstado; mecanismo:string|null; tratamiento:string|null; observaciones:string|null; createdBy:string }
export type EventoTipo = 'partido'|'entrenamiento'|'concentracion'|'medico'|'otro'
export interface Evento { id:string; clubId:string; titulo:string; descripcion:string|null; tipo:EventoTipo; fecha:string; horaInicio:string|null; horaFin:string|null; lugar:string|null; rival:string|null; obligatorio:boolean; createdBy:string }
export type ConvocatoriaEstado = 'confirmado'|'pendiente'|'no_disponible'
export interface ConvocatoriaJugador { playerId:string; playerName:string; position:string; estado:ConvocatoriaEstado; observacion:string|null }
export interface Convocatoria { id:string; clubId:string; eventoId:string|null; titulo:string; fecha:string; horaConcentracion:string|null; horaPartido:string|null; lugar:string|null; rival:string|null; transporte:string|null; equipamiento:string[]; notas:string|null; jugadores:ConvocatoriaJugador[]; createdBy:string }
export interface PlayerMatchStats { playerId:string; playerName:string; position:string; minutosJugados:number; tries:number; asistencias:number; metrosGanados:number; pasesCompletados:number; pasesTotales:number; carreras:number; tacklesCompletados:number; tacklesTotales:number; tacklesFallados:number; turnoversGanados:number; lineoutsGanados:number; lineoutsTotales:number; amarillas:number; rojas:number; penalesCometidos:number; pateadasTotal:number; pateadasMetros:number; nota:string|null }
export interface TeamMatchStats { puntosAFavor:number; puntoEnContra:number; triesAFavor:number; triesEnContra:number; posesionPct:number; territorioPct:number; scrumGanados:number; scrumTotales:number; lineoutGanados:number; lineoutTotales:number; metrosTotales:number; pasesTotales:number; tacklesPct:number; penalesCometidos:number; amarillas:number; rojas:number }

export interface PdfImportDoc {
  id: string
  clubId: string
  type: 'minutaggi'|'presenze'|'stats_generali'|'stats_individuali'
  matchKey: string   // e.g. "vs_RUGBY_COLORNO_2026-05-03" or "stagione_25_26"
  rival: string
  date: string
  fileName: string
  data: any
  createdAt: any
}
