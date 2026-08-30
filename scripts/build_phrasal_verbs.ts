/**
 * One-shot generator for `data/phrasal_verbs.json`.
 *
 * The authored source is the ROWS table below: [root, target, definition,
 * translation]. Ids are assigned sequentially in table order (`pv-001`…), so
 * NEW ITEMS MUST BE APPENDED, never inserted — the SRS schedule in
 * localStorage is keyed by id, and renumbering would silently reassign every
 * learner's progress to the wrong verb.
 *
 * After the first run, `data/phrasal_verbs.json` is the source of truth and
 * `scripts/validate_phrasal_verbs.ts` is the gate that protects it. Re-run this
 * only to regenerate the file wholesale.
 *
 *   npx tsx scripts/build_phrasal_verbs.ts
 *
 * It refuses to write if any row fails a structural check.
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptedForms, coreForm } from "../lib/phrasal";

type Row = [root: string, target: string, definition: string, translation: string];

// Definitions are C2-level English glosses; translations give the Spanish
// equivalent first, then the Catalan, separated by " / ".
const ROWS: Row[] = [
  // ── GET ──────────────────────────────────────────────────────────────────
  ["GET", "get across [sth]", "To convey an idea or message so that it is properly understood.", "hacer entender algo, transmitir una idea / fer entendre alguna cosa"],
  ["GET", "get along / on with [sb]", "To have a harmonious relationship with someone.", "llevarse bien con alguien / avenir-se amb algú"],
  ["GET", "get at [sb]", "To criticize someone persistently and unfairly.", "meterse con alguien / ficar-se amb algú"],
  ["GET", "get at [sth]", "To imply something indirectly; also, to manage to reach or access it.", "insinuar algo, acceder a algo / insinuar alguna cosa, accedir-hi"],
  ["GET", "get away with [doing sth]", "To escape punishment or criticism for something you have done.", "salirse con la suya, quedar impune / sortir-se'n impunement"],
  ["GET", "get [sb] down", "To make someone feel dispirited or depressed over time.", "desanimar, deprimir a alguien / desanimar algú"],
  ["GET", "get [sth] down", "To write something down quickly; also, to swallow with difficulty.", "apuntar algo, tragar algo / apuntar alguna cosa, empassar-se-la"],
  ["GET", "get down to doing [sth]", "To begin applying yourself seriously to a task after delay.", "ponerse en serio a hacer algo / posar-se de debò a fer alguna cosa"],
  ["GET", "get in on [sth]", "To become involved in something advantageous that is already under way.", "apuntarse a algo, meterse en algo / apuntar-se a alguna cosa"],
  ["GET", "get in with [sb]", "To ingratiate yourself with a person or group in order to gain advantage.", "congraciarse con alguien, hacerse amigo de / congraciar-se amb algú"],
  ["GET", "get off on [sth]", "To derive intense, often illicit, pleasure or excitement from something.", "disfrutar morbosamente con algo / gaudir morbosament d'alguna cosa"],
  ["GET", "get [sb] off", "To secure someone's acquittal or spare them a punishment.", "librar a alguien del castigo, lograr su absolución / lliurar algú del càstig"],
  ["GET", "get on for [age / time]", "To be approaching a particular age, time or quantity.", "rondar, acercarse a (una edad u hora) / vorejar, atansar-se a"],
  ["GET", "get out of doing [sth]", "To avoid an obligation you were expected to fulfil.", "librarse de hacer algo, escaquearse / escapolir-se de fer alguna cosa"],
  ["GET", "get round / around [sb]", "To persuade someone by cajoling or flattering them.", "engatusar, camelar a alguien / entabanar algú"],
  ["GET", "get round / around [a problem]", "To find a way of circumventing an obstacle or restriction.", "sortear, eludir un problema / esquivar un problema"],
  ["GET", "get round / around to doing [sth]", "To finally find the time to do something long postponed.", "encontrar por fin el momento de hacer algo / trobar per fi el moment de fer-ho"],
  ["GET", "get through to [sb]", "To make someone finally understand; also, to reach them by telephone.", "hacerse entender por alguien, contactar por teléfono / fer-se entendre, contactar per telèfon"],
  ["GET", "get through [an exam / an ordeal]", "To pass a test or survive a difficult experience.", "aprobar, superar (una prueba o un trance) / aprovar, superar"],
  ["GET", "get up to [sth]", "To do something mischievous or of which others would disapprove.", "hacer travesuras, andar metido en algo / fer entremaliadures"],

  // ── SET ──────────────────────────────────────────────────────────────────
  ["SET", "set about doing [sth]", "To begin a task in an energetic and purposeful way.", "empezar a hacer algo, ponerse a / posar-se a fer alguna cosa"],
  ["SET", "set [sb/sth] apart from [sb/sth]", "To be the quality that distinguishes one person or thing from another.", "distinguir, diferenciar de / distingir de"],
  ["SET", "set [sth] aside", "To reserve something for later use; also, to annul or disregard it.", "reservar algo, dejar de lado, anular / reservar, deixar de banda"],
  ["SET", "set [sb] back [an amount]", "To cost someone a specified, usually large, sum of money.", "costarle a alguien (una suma) / costar (una quantitat) a algú"],
  ["SET", "set [sth] back", "To delay the progress of something.", "retrasar algo / endarrerir alguna cosa"],
  ["SET", "set in", "Of weather, decay or an unwelcome condition: to begin and show every sign of persisting.", "instalarse, empezar (mal tiempo, deterioro) / instal·lar-se, començar (mal temps)"],
  ["SET", "set off [sth]", "To trigger something, especially an alarm, a reaction or a chain of events.", "desencadenar algo, hacer saltar (una alarma) / desencadenar, fer saltar"],
  ["SET", "set out to do [sth]", "To begin an undertaking with a specific aim in mind.", "proponerse hacer algo / proposar-se fer alguna cosa"],
  ["SET", "set out [sth]", "To arrange things systematically, or to explain ideas in an ordered way.", "exponer algo ordenadamente, disponer / exposar, disposar"],
  ["SET", "set [sb] up", "To frame someone for a crime; also, to establish them financially.", "tender una trampa a alguien, montarle un negocio / parar un parany a algú, establir algú"],
  ["SET", "set upon / on [sb]", "To attack someone suddenly and violently.", "abalanzarse sobre alguien, atacar / abraonar-se sobre algú"],

  // ── COME ─────────────────────────────────────────────────────────────────
  ["COME", "come about", "To happen or come to pass, especially in a way that was not planned.", "suceder, producirse / esdevenir-se"],
  ["COME", "come across [sb/sth]", "To encounter someone or something by chance.", "toparse con, encontrar por casualidad / topar amb"],
  ["COME", "come across as [adj / noun]", "To give a particular impression to other people.", "dar la impresión de, parecer / fer l'efecte de"],
  ["COME", "come by [sth]", "To obtain something, usually with some difficulty.", "conseguir algo, hacerse con / aconseguir alguna cosa"],
  ["COME", "come down to [sth]", "To be reducible, in the end, to one essential factor.", "reducirse a algo, ser cuestión de / reduir-se a"],
  ["COME", "come down with [an illness]", "To start suffering from an illness, usually a mild one.", "caer enfermo de, pillar (una enfermedad) / agafar (una malaltia)"],
  ["COME", "come in for [criticism / praise]", "To be the object of a particular reaction, especially criticism.", "recibir, ser objeto de (críticas) / rebre, ser objecte de (crítiques)"],
  ["COME", "come off", "Of a plan or attempt: to succeed.", "salir bien, cuajar / sortir bé, reeixir"],
  ["COME", "come out with [a statement / remark]", "To say something unexpected or startling.", "soltar (un comentario) / amollar (un comentari)"],
  ["COME", "come round / around to [an idea / point of view]", "To be gradually won over to an opinion you first resisted.", "acabar aceptando (una idea) / acabar acceptant (una idea)"],
  ["COME", "come round / around", "To regain consciousness after fainting or an anaesthetic.", "volver en sí / tornar en si"],
  ["COME", "come through [a crisis / difficult period]", "To survive a dangerous or difficult period.", "superar (una crisis), salir adelante / superar (una crisi)"],
  ["COME", "come to terms with [sth]", "To reach acceptance of something painful or unwelcome.", "aceptar, asumir, hacerse a la idea de / assumir, fer-se a la idea de"],
  ["COME", "come up against [an obstacle / opposition]", "To be confronted by a difficulty or by resistance.", "tropezar con, enfrentarse a (un obstáculo) / topar amb (un obstacle)"],
  ["COME", "come up to [expectations / scratch]", "To reach the expected or required standard.", "estar a la altura de / estar a l'altura de"],
  ["COME", "come up with [an idea / solution]", "To devise or produce an idea, plan or answer.", "idear, dar con (una idea) / idear, trobar (una idea)"],
  ["COME", "come into [money / property]", "To inherit money or property.", "heredar (dinero, bienes) / heretar (diners, béns)"],

  // ── BRING ────────────────────────────────────────────────────────────────
  ["BRING", "bring [sth] about", "To cause something to happen.", "provocar, ocasionar algo / provocar alguna cosa"],
  ["BRING", "bring [sth] around / round to [a topic]", "To steer a conversation towards a particular subject.", "llevar (la conversación) hacia (un tema) / menar (la conversa) cap a (un tema)"],
  ["BRING", "bring [sb] around / round", "To persuade someone to change their mind; also, to revive them.", "convencer a alguien, hacerlo volver en sí / convèncer algú, fer-lo tornar en si"],
  ["BRING", "bring [sth] back", "To evoke a memory; also, to reinstate something abolished.", "traer a la memoria, reinstaurar / fer venir a la memòria, restablir"],
  ["BRING", "bring [sth] down", "To topple a government; also, to reduce prices or levels.", "derribar (un gobierno), bajar (precios) / enderrocar (un govern), abaixar (preus)"],
  ["BRING", "bring [sth] forward", "To put forward a proposal; also, to reschedule something to an earlier date.", "presentar (una propuesta), adelantar (una fecha) / presentar (una proposta), avançar (una data)"],
  ["BRING", "bring [sth] in", "To introduce a law or measure; also, to earn or generate income.", "introducir (una ley), generar (ingresos) / introduir (una llei), generar (ingressos)"],
  ["BRING", "bring [sth] off", "To succeed in doing something difficult.", "sacar adelante algo, lograrlo / reeixir en alguna cosa difícil"],
  ["BRING", "bring [sth] on", "To trigger an illness or a crisis.", "provocar (una enfermedad, una crisis) / provocar (una malaltia, una crisi)"],
  ["BRING", "bring [sth] out", "To publish or release something; also, to make a quality more evident.", "sacar, publicar, resaltar (una cualidad) / publicar, fer ressaltar"],
  ["BRING", "bring [sb] up", "To raise and educate a child.", "criar, educar a alguien / criar, educar algú"],
  ["BRING", "bring [sth] up", "To mention a subject; also, to vomit.", "sacar (un tema), vomitar / treure (un tema), vomitar"],

  // ── PUT ──────────────────────────────────────────────────────────────────
  ["PUT", "put [sth] across / over", "To communicate an idea clearly and convincingly.", "transmitir, comunicar algo con claridad / transmetre amb claredat"],
  ["PUT", "put [sth] aside / by", "To save money for later; also, to disregard differences.", "ahorrar (dinero), dejar de lado (diferencias) / estalviar (diners), deixar de banda"],
  ["PUT", "put [sb] down", "To belittle or humiliate someone, especially in public.", "menospreciar, humillar a alguien / menysprear algú"],
  ["PUT", "put [sth] down to [sth]", "To attribute something to a particular cause.", "atribuir algo a / atribuir alguna cosa a"],
  ["PUT", "put forward [a proposal / candidate]", "To propose an idea or nominate a person for consideration.", "presentar, proponer (una propuesta, un candidato) / presentar, proposar"],
  ["PUT", "put [sth] off", "To postpone something; also, to deter or repel.", "aplazar algo, disuadir / ajornar, dissuadir"],
  ["PUT", "put [sb] off doing [sth]", "To make someone lose the desire to do something.", "quitarle a alguien las ganas de hacer algo / llevar-li a algú les ganes de fer alguna cosa"],
  ["PUT", "put [sth] on", "To stage a production; also, to gain weight, or to feign an attitude.", "montar (un espectáculo), engordar, fingir / muntar (un espectacle), engreixar-se, fingir"],
  ["PUT", "put [sb] out", "To inconvenience or trouble someone.", "causar molestias a alguien, incomodarlo / amoïnar, molestar algú"],
  ["PUT", "put [a fire / light] out", "To extinguish a fire or a light.", "apagar (un fuego, una luz) / apagar (un foc, un llum)"],
  ["PUT", "put [sb] through to [sb]", "To connect a caller to another person on the telephone.", "pasarle a alguien (una llamada) / passar (una trucada) a algú"],
  ["PUT", "put [sb] through [an ordeal / college]", "To make someone endure an ordeal; also, to fund their studies.", "hacer pasar a alguien por (un trance), pagarle los estudios / fer passar algú per (un tràngol), pagar-li els estudis"],
  ["PUT", "put up with [sb/sth]", "To tolerate something unpleasant without complaining.", "aguantar, soportar / aguantar, suportar"],
  ["PUT", "put [sb] up", "To provide someone with accommodation.", "alojar a alguien / allotjar algú"],

  // ── TAKE ─────────────────────────────────────────────────────────────────
  ["TAKE", "take [sb] aback", "To startle and disconcert someone.", "desconcertar, pillar por sorpresa a alguien / desconcertar, agafar de sorpresa algú"],
  ["TAKE", "take after [sb]", "To resemble an older relative in looks or character.", "parecerse a, salir a (un familiar) / assemblar-se a (un familiar)"],
  ["TAKE", "take [sth] back", "To retract a statement you now regret.", "retirar lo dicho, retractarse / retirar el que s'ha dit"],
  ["TAKE", "take [sth] down", "To dismantle a structure; also, to write something down.", "desmontar, anotar / desmuntar, anotar"],
  ["TAKE", "take [sb] in", "To deceive someone completely.", "engañar, embaucar a alguien / enganyar algú"],
  ["TAKE", "take [sth] in", "To absorb and comprehend information; also, to make a garment narrower.", "asimilar, comprender, meter (una prenda) / assimilar, comprendre, estrènyer (una peça)"],
  ["TAKE", "take off", "To succeed suddenly and rapidly; also, to imitate someone mockingly.", "despegar, triunfar de golpe, imitar / enlairar-se, triomfar de cop, imitar"],
  ["TAKE", "take [sb] on", "To employ someone; also, to compete against them.", "contratar a alguien, enfrentarse a él / contractar algú, enfrontar-s'hi"],
  ["TAKE", "take [sth] on", "To assume a responsibility or workload.", "asumir (una responsabilidad) / assumir (una responsabilitat)"],
  ["TAKE", "take [sth] out on [sb]", "To vent your frustration on someone who is not to blame.", "pagarlo con alguien, desahogarse con él / pagar-ho amb algú"],
  ["TAKE", "take to [sb/sth]", "To develop a liking for someone or something.", "cogerle cariño a, gustarle a uno / agafar-hi afecte"],
  ["TAKE", "take to doing [sth]", "To adopt something as a habit.", "darle a uno por hacer algo / donar-li a algú per fer alguna cosa"],
  ["TAKE", "take up [a hobby / space / time]", "To start a pursuit; also, to occupy space or time.", "empezar (una afición), ocupar (espacio, tiempo) / començar (una afició), ocupar (espai, temps)"],
  ["TAKE", "take [sb] up on [an offer]", "To accept an offer someone has made.", "aceptarle a alguien (una oferta) / acceptar-li a algú (una oferta)"],

  // ── RUN ──────────────────────────────────────────────────────────────────
  ["RUN", "run across / into [sb]", "To meet someone by chance.", "toparse con alguien, encontrárselo por casualidad / topar amb algú"],
  ["RUN", "run after [sb]", "To chase someone; also, to pursue them romantically.", "perseguir a alguien, ir detrás de él / perseguir algú, anar-li al darrere"],
  ["RUN", "run against [sb]", "To stand against someone in an election.", "presentarse contra alguien (en unas elecciones) / presentar-se contra algú"],
  ["RUN", "run [sb/sth] down", "To disparage someone; also, to knock someone down with a vehicle.", "criticar, menospreciar, atropellar / criticar, menysprear, atropellar"],
  ["RUN", "run down", "Of a battery or an institution: to lose power or fall into decline.", "descargarse (una batería), venirse abajo / descarregar-se, decaure"],
  ["RUN", "run into [difficulties / debt]", "To encounter trouble, or to fall into debt.", "tropezar con (dificultades), endeudarse / topar amb (dificultats), endeutar-se"],
  ["RUN", "run out of [sth]", "To exhaust your supply of something.", "quedarse sin algo / quedar-se sense alguna cosa"],
  ["RUN", "run through [sth]", "To rehearse or review something quickly; also, to squander money.", "repasar algo, dilapidar (dinero) / repassar, dilapidar"],
  ["RUN", "run to [an amount / length]", "To amount to a figure, or to extend to a given length.", "ascender a, alcanzar (una cifra, una extensión) / ascendir a, arribar a"],
  ["RUN", "run up [debts / a bill]", "To accumulate debts or charges.", "acumular (deudas), dejar a deber / acumular (deutes)"],
  ["RUN", "run up against [resistance / a problem]", "To come up against opposition or an unforeseen difficulty.", "topar con (resistencia, un problema) / topar amb (resistència, un problema)"],

  // ── CALL ─────────────────────────────────────────────────────────────────
  ["CALL", "call for [sth]", "To demand or require something; also, to collect someone on the way.", "exigir, requerir algo, pasar a recoger a alguien / exigir, requerir, passar a recollir algú"],
  ["CALL", "call forth [sth]", "To evoke a reaction or response.", "suscitar, provocar (una reacción) / suscitar, provocar (una reacció)"],
  ["CALL", "call [sth] in", "To summon an expert; also, to demand repayment of a loan.", "llamar a (un experto), reclamar (un préstamo) / cridar (un expert), reclamar (un préstec)"],
  ["CALL", "call in on [sb]", "To pay someone a brief visit.", "pasar a ver a alguien / passar a veure algú"],
  ["CALL", "call [sth] off", "To cancel an event or abandon a course of action.", "cancelar, suspender algo / cancel·lar, suspendre alguna cosa"],
  ["CALL", "call on / upon [sb] to do [sth]", "To formally request or urge someone to act.", "instar a alguien a hacer algo / instar algú a fer alguna cosa"],
  ["CALL", "call [sb] out on [sth]", "To challenge someone publicly over something they have said or done.", "reprochar públicamente a alguien, ponerlo en evidencia / retreure públicament a algú"],
  ["CALL", "call [sb] up", "To telephone someone; also, to conscript them into the armed forces.", "llamar por teléfono a alguien, llamarlo a filas / trucar algú, cridar-lo a files"],

  // ── FALL ─────────────────────────────────────────────────────────────────
  ["FALL", "fall back on [sth]", "To resort to something kept in reserve when other options fail.", "recurrir a algo como último recurso / recórrer a alguna cosa com a darrer recurs"],
  ["FALL", "fall behind with [payments / schedule]", "To fail to keep up with payments or a timetable.", "atrasarse con (los pagos, el calendario) / endarrerir-se amb (els pagaments)"],
  ["FALL", "fall for [sb]", "To fall in love with someone.", "enamorarse de alguien, colarse por él / enamorar-se d'algú"],
  ["FALL", "fall for [a trick / scam]", "To be taken in by a deception.", "picar, tragarse (un engaño) / picar, empassar-se (un engany)"],
  ["FALL", "fall in with [a crowd / a suggestion]", "To take up with a group; also, to agree to a proposal.", "juntarse con (malas compañías), aceptar (una sugerencia) / ajuntar-se amb, acceptar"],
  ["FALL", "fall out with [sb] over [sth]", "To quarrel with someone and break off relations.", "pelearse, enemistarse con alguien por algo / barallar-se amb algú per alguna cosa"],
  ["FALL", "fall through", "Of a plan or deal: to collapse before completion.", "irse al traste, fracasar (un plan) / anar-se'n en orris, fracassar"],
  ["FALL", "fall to [sb] to do [sth]", "To become someone's duty or responsibility.", "corresponderle a alguien hacer algo, tocarle / correspondre a algú fer alguna cosa"],

  // ── HOLD ─────────────────────────────────────────────────────────────────
  ["HOLD", "hold [sth] against [sb]", "To continue to resent someone for something they did.", "tenerle algo en cuenta a alguien, guardarle rencor / tenir en compte alguna cosa a algú"],
  ["HOLD", "hold back from doing [sth]", "To restrain yourself from doing something.", "abstenerse, contenerse de hacer algo / abstenir-se de fer alguna cosa"],
  ["HOLD", "hold [sth] down", "To keep a job over time; also, to suppress or restrain something.", "conservar (un empleo), reprimir / conservar (una feina), reprimir"],
  ["HOLD", "hold forth on [a topic]", "To speak at tedious length about a subject.", "perorar, explayarse sobre (un tema) / perorar sobre (un tema)"],
  ["HOLD", "hold [sth] off", "To delay something, or to keep a threat at bay.", "aplazar algo, mantenerlo a raya / ajornar, mantenir a ratlla"],
  ["HOLD", "hold out for [better terms]", "To refuse to settle until you get the terms you want.", "aguantar, insistir hasta lograr (mejores condiciones) / aguantar fins a obtenir (millors condicions)"],
  ["HOLD", "hold out on [sb]", "To withhold information or help from someone.", "ocultarle información a alguien / amagar informació a algú"],
  ["HOLD", "hold [sth] over [sb]", "To use knowledge of something as leverage against someone.", "usar algo como amenaza contra alguien, tenerlo cogido / fer servir alguna cosa com a amenaça contra algú"],
  ["HOLD", "hold [sb/sth] up", "To delay someone or something; also, to rob at gunpoint.", "retrasar, atracar / endarrerir, atracar"],
  ["HOLD", "hold up under [scrutiny / pressure]", "To withstand examination or pressure without failing.", "resistir, aguantar (el escrutinio, la presión) / resistir (l'escrutini, la pressió)"],
  ["HOLD", "hold with [an idea]", "To approve of an idea — almost always used in the negative.", "estar de acuerdo con, aprobar (una idea) / estar d'acord amb (una idea)"],

  // ── LOOK ─────────────────────────────────────────────────────────────────
  ["LOOK", "look down on [sb]", "To regard someone as inferior.", "mirar por encima del hombro a alguien, despreciarlo / mirar algú per damunt de l'espatlla"],
  ["LOOK", "look in on [sb]", "To visit someone briefly, especially to check on them.", "pasar a ver a alguien / passar a veure algú"],
  ["LOOK", "look into [sth]", "To investigate a matter.", "investigar, estudiar algo / investigar alguna cosa"],
  ["LOOK", "look on / upon [sb/sth] as [sth]", "To regard someone or something in a particular way.", "considerar a alguien o algo como / considerar algú o alguna cosa com a"],
  ["LOOK", "look out for [sb/sth]", "To keep watch for something; also, to protect someone's interests.", "estar atento a, velar por / estar a l'aguait de, vetllar per"],
  ["LOOK", "look over / through [sth]", "To examine something quickly.", "revisar, echar un vistazo a algo / revisar, fer una ullada a alguna cosa"],
  ["LOOK", "look to [sb] for [sth]", "To rely on someone to provide something.", "recurrir a alguien en busca de algo, contar con él / recórrer a algú per obtenir alguna cosa"],
  ["LOOK", "look up to [sb]", "To admire and respect someone.", "admirar a alguien, tenerlo como modelo / admirar algú"],

  // ── MAKE ─────────────────────────────────────────────────────────────────
  ["MAKE", "make away / off with [sth]", "To steal something and escape with it.", "llevarse algo, largarse con el botín / endur-se alguna cosa, fugir amb el botí"],
  ["MAKE", "make for [a place]", "To head towards a place.", "dirigirse a (un lugar) / dirigir-se a (un lloc)"],
  ["MAKE", "make of [sb/sth]", "To form an opinion about, or interpret, someone or something.", "opinar de, entender de (algo o alguien) / opinar de, entendre de"],
  ["MAKE", "make [sth] out", "To discern something faintly; also, to claim falsely, or to write out a cheque.", "distinguir algo, pretender, extender (un cheque) / distingir, pretendre, estendre (un xec)"],
  ["MAKE", "make [sb] out to be [adj / noun]", "To portray someone as being something they are not.", "hacer pasar a alguien por, pintarlo como / fer passar algú per"],
  ["MAKE", "make over [property / assets] to [sb]", "To transfer property or assets legally to someone.", "traspasar, ceder (bienes) a alguien / traspassar (béns) a algú"],
  ["MAKE", "make up for [sth]", "To compensate for a loss or a shortcoming.", "compensar algo, resarcir / compensar alguna cosa"],
  ["MAKE", "make up to [sb]", "To flatter someone in order to gain their favour.", "hacerle la pelota a alguien, congraciarse / fer la pilota a algú"],

  // ── STAND ────────────────────────────────────────────────────────────────
  ["STAND", "stand by [sb]", "To remain loyal to someone in difficulty.", "apoyar a alguien, no dejarlo tirado / donar suport a algú"],
  ["STAND", "stand by [a statement / decision]", "To adhere to something you have said or decided.", "mantener (lo dicho, una decisión) / mantenir (una decisió)"],
  ["STAND", "stand down from [a post]", "To resign from a position or withdraw a candidacy.", "dimitir de (un cargo), retirarse / dimitir d'(un càrrec)"],
  ["STAND", "stand for [sth]", "To represent or symbolize something; also, to tolerate it.", "significar, representar, tolerar / significar, representar, tolerar"],
  ["STAND", "stand in for [sb]", "To act as a substitute for someone.", "sustituir a alguien, hacer de suplente / substituir algú"],
  ["STAND", "stand out against [a policy]", "To resist a policy or trend openly.", "oponerse abiertamente a (una política) / oposar-se obertament a (una política)"],
  ["STAND", "stand out from [the crowd]", "To be conspicuously better or more noticeable than others.", "destacar entre (la multitud) / destacar entre (la multitud)"],
  ["STAND", "stand up for [sb/sth]", "To defend a person or a principle.", "defender a, dar la cara por / defensar, donar la cara per"],
  ["STAND", "stand up to [scrutiny / bullying]", "To withstand examination; also, to confront someone intimidating.", "resistir (el escrutinio), plantar cara a / resistir, plantar cara a"],

  // ── TURN ─────────────────────────────────────────────────────────────────
  ["TURN", "turn [sb] away", "To refuse someone entry or assistance.", "rechazar a alguien, negarle la entrada / rebutjar algú, negar-li l'entrada"],
  ["TURN", "turn [sth] down", "To reject an offer; also, to reduce the volume or heat.", "rechazar algo, bajar (el volumen) / rebutjar, abaixar (el volum)"],
  ["TURN", "turn [sb] in", "To hand someone over to the police.", "entregar a alguien a la policía, delatarlo / lliurar algú a la policia, delatar-lo"],
  ["TURN", "turn in", "To go to bed.", "irse a la cama, acostarse / anar-se'n al llit"],
  ["TURN", "turn out", "To attend an event in numbers; also, to produce or manufacture.", "acudir, presentarse, producir / acudir, presentar-se, produir"],
  ["TURN", "turn out to be [sth]", "To prove to be the case in the end.", "resultar ser algo / resultar ser alguna cosa"],
  ["TURN", "turn to [sb] for [help / advice]", "To seek help or advice from someone.", "acudir a alguien en busca de (ayuda) / acudir a algú a la recerca d'(ajuda)"],
  ["TURN", "turn up", "To arrive unexpectedly; also, to increase the volume or heat.", "aparecer, presentarse, subir (el volumen) / aparèixer, presentar-se, apujar (el volum)"],

  // ── PULL ─────────────────────────────────────────────────────────────────
  ["PULL", "pull [sth] off", "To succeed in something difficult against the odds.", "lograr algo difícil, sacarlo adelante / reeixir en alguna cosa difícil"],
  ["PULL", "pull out of [a deal / competition]", "To withdraw from an agreement or a contest.", "retirarse de (un acuerdo, una competición) / retirar-se d'(un acord, una competició)"],
  ["PULL", "pull through [an illness / crisis]", "To survive a serious illness or crisis.", "recuperarse de, salir adelante / recuperar-se de, sortir-se'n"],
  ["PULL", "pull together", "To cooperate in a common effort.", "arrimar el hombro, trabajar unidos / arrimar l'espatlla, treballar plegats"],
  ["PULL", "pull [sb] up on [a mistake]", "To reprimand someone for an error.", "llamarle la atención a alguien por (un error) / cridar l'atenció a algú per (un error)"],

  // ── BEAR ─────────────────────────────────────────────────────────────────
  ["BEAR", "bear [sth] out", "To corroborate a claim with evidence.", "corroborar, confirmar algo / corroborar alguna cosa"],
  ["BEAR", "bear up under [strain / pressure]", "To endure strain without breaking down.", "aguantar, resistir (la presión) / aguantar (la pressió)"],
  ["BEAR", "bear with [sb]", "To be patient with someone.", "tener paciencia con alguien / tenir paciència amb algú"],

  // ── CARRY ────────────────────────────────────────────────────────────────
  ["CARRY", "carry [sth] off", "To handle something demanding successfully.", "salir airoso de algo, lograrlo / sortir-se'n amb èxit"],
  ["CARRY", "carry [sth] out", "To execute an order, a plan or a piece of research.", "llevar a cabo, realizar algo / dur a terme alguna cosa"],
  ["CARRY", "carry [sth] over into [sth]", "To transfer something into a later period or another context.", "trasladar algo a, arrastrarlo hasta / traslladar alguna cosa a"],

  // ── CAST ─────────────────────────────────────────────────────────────────
  ["CAST", "cast about / around for [a solution / excuse]", "To search anxiously for something, especially an idea or a pretext.", "buscar desesperadamente (una solución, una excusa) / cercar desesperadament (una solució)"],
  ["CAST", "cast [sth] aside", "To discard something or someone as no longer of use.", "desechar algo, dejarlo de lado / descartar alguna cosa"],

  // ── DRAW ─────────────────────────────────────────────────────────────────
  ["DRAW", "draw on / upon [experience / resources]", "To make use of a store of experience or resources.", "recurrir a, servirse de (la experiencia) / recórrer a (l'experiència)"],
  ["DRAW", "draw [sth] out", "To prolong something beyond its natural length.", "alargar, prolongar algo / allargar alguna cosa"],
  ["DRAW", "draw [a contract / document] up", "To draft a formal document.", "redactar (un contrato, un documento) / redactar (un contracte)"],

  // ── LAY ──────────────────────────────────────────────────────────────────
  ["LAY", "lay [sth] down", "To establish a rule or principle; also, to relinquish arms.", "establecer (una norma), deponer (las armas) / establir (una norma), deposar (les armes)"],
  ["LAY", "lay into [sb]", "To attack someone verbally or physically.", "arremeter contra alguien, ponerlo a caldo / envestir contra algú"],
  ["LAY", "lay off [workers]", "To make employees redundant.", "despedir a (trabajadores) / acomiadar (treballadors)"],
  ["LAY", "lay off doing [sth]", "To stop doing something irritating.", "dejar de hacer algo, parar / deixar de fer alguna cosa"],
  ["LAY", "lay [sth] out", "To explain something clearly and in order; also, to spend money.", "exponer algo con claridad, desembolsar / exposar amb claredat, desemborsar"],

  // ── LET ──────────────────────────────────────────────────────────────────
  ["LET", "let [sb] down", "To disappoint someone by failing to do what they expected.", "defraudar a alguien, fallarle / decebre algú, fallar-li"],
  ["LET", "let [sb] in on [a secret]", "To share a secret or plan with someone.", "contarle a alguien (un secreto), hacerlo partícipe / fer partícip algú d'(un secret)"],
  ["LET", "let [sb] off with [a warning / light sentence]", "To punish someone leniently or not at all.", "dejar a alguien con (un aviso), no castigarlo / deixar-ho estar amb (un advertiment)"],

  // ── STRIKE ───────────────────────────────────────────────────────────────
  ["STRIKE", "strike out at [sb]", "To lash out at someone, verbally or physically.", "arremeter contra alguien / envestir contra algú"],
  ["STRIKE", "strike up [a conversation / friendship]", "To begin a conversation or friendship, often with a stranger.", "entablar (una conversación, una amistad) / entaular (una conversa, una amistat)"],

  // ── CATCH ────────────────────────────────────────────────────────────────
  ["CATCH", "catch on", "To become popular; also, to grasp what is going on.", "cuajar, ponerse de moda, pillarlo / quallar, posar-se de moda, entendre-ho"],
  ["CATCH", "catch up with [sb]", "Of past actions: to have consequences for someone at last.", "pasarle factura a alguien, alcanzarlo / passar factura a algú"],

  // ── PASS ─────────────────────────────────────────────────────────────────
  ["PASS", "pass for [sb/sth]", "To be accepted as something or someone you are not.", "pasar por (algo o alguien) / passar per"],
  ["PASS", "pass [sth] off as [sth]", "To misrepresent something as being something else.", "hacer pasar algo por (otra cosa) / fer passar alguna cosa per"],
  ["PASS", "pass [an opportunity] up", "To decline or miss an opportunity.", "dejar pasar (una oportunidad) / deixar passar (una oportunitat)"],
];

interface PhrasalRecord {
  id: string;
  root: string;
  target: string;
  definition: string;
  translation: string;
}

function main(): void {
  const problems: string[] = [];
  const records: PhrasalRecord[] = ROWS.map(([root, target, definition, translation], i) => ({
    id: `pv-${String(i + 1).padStart(3, "0")}`,
    root,
    target,
    definition,
    translation,
  }));

  const seenTarget = new Map<string, string[]>();

  for (const r of records) {
    if (!/^[A-Z]+$/.test(r.root)) problems.push(`${r.id}: root "${r.root}" is not uppercase A–Z`);

    // The root verb must open the target, or the Root Matrix would file the
    // item under a verb that does not appear in the answer.
    const firstWord = r.target.trim().split(/\s+/)[0].toLowerCase();
    if (firstWord !== r.root.toLowerCase()) {
      problems.push(`${r.id}: target "${r.target}" does not begin with its root "${r.root}"`);
    }

    const opens = (r.target.match(/\[/g) ?? []).length;
    const closes = (r.target.match(/\]/g) ?? []).length;
    if (opens !== closes) problems.push(`${r.id}: unbalanced brackets in "${r.target}"`);

    if (coreForm(r.target).split(" ").length < 2) {
      problems.push(`${r.id}: "${r.target}" reduces to fewer than two words — not a phrasal verb`);
    }
    if (acceptedForms(r.target).length === 0) {
      problems.push(`${r.id}: "${r.target}" produces no accepted form`);
    }
    if (r.definition.trim() === "") problems.push(`${r.id}: empty definition`);
    if (!r.translation.includes(" / ")) {
      problems.push(`${r.id}: translation "${r.translation}" has no " / " separating ES from CA`);
    }

    const key = coreForm(r.target);
    seenTarget.set(key, [...(seenTarget.get(key) ?? []), r.id]);
  }

  if (problems.length > 0) {
    console.error(`✗ ${problems.length} problem(s); refusing to write:\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, "..", "data", "phrasal_verbs.json");
  writeFileSync(out, `${JSON.stringify(records, null, 2)}\n`, "utf8");

  const roots = new Set(records.map((r) => r.root));
  console.log(`✓ wrote ${records.length} phrasal verbs across ${roots.size} roots to ${out}`);

  // Same core form under two senses is legitimate ("run down" is both "run
  // [sb/sth] down" and the intransitive decline sense) — the definition
  // disambiguates — but it is worth seeing the list.
  const collisions = [...seenTarget.entries()].filter(([, ids]) => ids.length > 1);
  if (collisions.length > 0) {
    console.log(`  ${collisions.length} core form(s) shared by more than one sense:`);
    for (const [core, ids] of collisions) console.log(`    ${core} → ${ids.join(", ")}`);
  }
}

main();
