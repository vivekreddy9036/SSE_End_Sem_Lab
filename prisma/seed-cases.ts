import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
});

async function main() {
  console.log("Seeding test cases for presentation...\n");

  // Fetch lookup data
  const branches = await prisma.branch.findMany();
  const stages = await prisma.caseStage.findMany();
  const users = await prisma.user.findMany({ include: { role: true } });

  const branch = (code: string) => branches.find((b) => b.code === code)!;
  const stage = (code: string) => stages.find((s) => s.code === code)!;
  const user = (username: string) => users.find((u) => u.username === username)!;

  // UID helper
  const uid = (branchCode: string, num: number) =>
    `ATS/${branchCode}/${new Date().getFullYear()}/${String(num).padStart(4, "0")}`;

  // Date helper — days ago from today
  const daysAgo = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    return dt;
  };

  const cases = [
    // ── CHENNAI (6 cases) ─────────────────────────
    {
      uid: uid("CNI", 1),
      psLimit: "Commissioner's Office, Chennai",
      crimeNumber: "CR-CNI-2025-0187",
      sectionOfLaw: "IPC 121, 121A, 122 — Waging War against Government",
      dateOfOccurrence: daysAgo(200),
      dateOfRegistration: daysAgo(195),
      complainantName: "S. Raghavan",
      accusedDetails: "Mohammed Farooq, age 34, resident of Royapuram, Chennai. Known associate of a banned outfit. Seized explosive materials from residence.",
      gist: "Intelligence-led raid on a hideout in Royapuram resulted in the seizure of 5 kg explosive material, detonators, and coded communication devices. Accused found to be in contact with banned organisations overseas via encrypted channels.",
      stageId: stage("PT").id,
      assignedOfficerId: user("INS1CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(195),
      actions: [
        "File chargesheet before Special NIA Court",
        "Obtain CDR analysis report from service providers",
        "Coordinate with NIA for inter-state linkages",
      ],
      progress: [
        { date: daysAgo(180), detail: "Chargesheet filed before Special Court. 3 accused chargesheeted.", action: "Pursue court dates for trial commencement" },
        { date: daysAgo(120), detail: "Court framed charges under IPC 121, 121A. Trial to commence.", action: "Summon prosecution witnesses" },
        { date: daysAgo(60), detail: "PW-1 to PW-4 examined. Cross-examination pending.", action: "Ensure remaining witnesses are served summons" },
      ],
    },
    {
      uid: uid("CNI", 2),
      psLimit: "ATS Unit, Egmore",
      crimeNumber: "CR-CNI-2025-0203",
      sectionOfLaw: "UAPA Sec 16, 18, 20 — Terrorist Act & Conspiracy",
      dateOfOccurrence: daysAgo(150),
      dateOfRegistration: daysAgo(148),
      complainantName: "K. Meenakshi Sundaram",
      accusedDetails: "Ashraf Ali, age 28, and Yusuf Khan, age 31, residents of Washermanpet. Planned attack on IT corridor using IEDs.",
      gist: "Based on intelligence inputs, two suspects were apprehended near Tidel Park with partially assembled IEDs. Investigation revealed a larger network operating across Tamil Nadu with links to international terror financing.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS2CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(148),
      actions: [
        "Complete forensic analysis of seized devices",
        "Obtain financial transaction records from banks",
        "Conduct identification parade",
      ],
      progress: [
        { date: daysAgo(140), detail: "FSL report received — confirms RDX traces on seized material.", action: "Send samples to CFSL Hyderabad for second opinion" },
        { date: daysAgo(100), detail: "Bank accounts frozen. Hawala transactions of ₹15L traced.", action: "File application for voice sample collection" },
      ],
    },
    {
      uid: uid("CNI", 3),
      psLimit: "Central Crime Branch, Chennai",
      crimeNumber: "CR-CNI-2024-0891",
      sectionOfLaw: "IPC 302, 307, Arms Act Sec 25",
      dateOfOccurrence: daysAgo(350),
      dateOfRegistration: daysAgo(345),
      complainantName: "R. Selvakumar",
      accusedDetails: "Imran Baig and 4 others. Organised targeted shooting of a political functionary in T.Nagar.",
      gist: "Contract killing of a local political leader linked to inter-gang rivalry with suspected terror financing angle. Investigation transferred to ATS from City Crime Branch due to terror financing trail.",
      stageId: stage("HC").id,
      assignedOfficerId: user("DSP CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(345),
      actions: [
        "File counter-affidavit in High Court against bail petition",
        "Obtain CCTV footage enhancement report",
      ],
      progress: [
        { date: daysAgo(300), detail: "Chargesheet filed. Accused produced before court.", action: "Oppose bail applications" },
        { date: daysAgo(200), detail: "Bail rejected by Sessions Court. Accused filed appeal in HC.", action: "File counter in High Court within 2 weeks" },
        { date: daysAgo(90), detail: "High Court hearing adjourned to next month. Counter filed.", action: "Attend next hearing and argue against bail" },
      ],
    },
    {
      uid: uid("CNI", 4),
      psLimit: "Cyber Crime Cell, Chennai",
      crimeNumber: "CR-CNI-2025-0412",
      sectionOfLaw: "IT Act Sec 66F, UAPA Sec 39 — Cyber Terrorism",
      dateOfOccurrence: daysAgo(90),
      dateOfRegistration: daysAgo(88),
      complainantName: "V. Anand Kumar",
      accusedDetails: "Praveen Raj, age 23, engineering graduate from Tambaram. Operated dark web forums for recruitment into radical groups.",
      gist: "Suspect operated anonymous forums on dark web recruiting vulnerable youth into radical ideology. Promoted violent extremism through encrypted Telegram channels with 2,000+ members. Digital forensic evidence recovered from 3 laptops and 2 mobile phones.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS3CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(88),
      actions: [
        "Complete digital forensic examination of seized devices",
        "Coordinate with Telegram for channel data",
        "Identify and examine other administrators of the channel",
      ],
      progress: [
        { date: daysAgo(70), detail: "Forensic mirror images of all devices created. Analysis underway.", action: "File interim status report before court" },
      ],
    },
    {
      uid: uid("CNI", 5),
      psLimit: "ATS Unit, Tambaram",
      crimeNumber: "CR-CNI-2025-0098",
      sectionOfLaw: "Explosive Substances Act Sec 3, 4, 5",
      dateOfOccurrence: daysAgo(250),
      dateOfRegistration: daysAgo(248),
      complainantName: "M. Pandian",
      accusedDetails: "Shankar and Dhanush, age 26 and 29, from Chengalpattu. Running an illegal explosives manufacturing unit.",
      gist: "Illegal explosives manufacturing unit busted in an abandoned warehouse near Chengalpattu. 20 kg of ammonium nitrate, 50 detonators, and assembly manuals seized. Suspects linked to illegal quarrying mafia with potential terror supply chain.",
      stageId: stage("PT").id,
      assignedOfficerId: user("INS4CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(248),
      actions: [
        "Produce FSL report in court",
        "Examine quarry owners for supply chain links",
      ],
      progress: [
        { date: daysAgo(230), detail: "Chargesheet filed. Both accused remanded to judicial custody.", action: "Follow up on FSL analysis timeline" },
        { date: daysAgo(170), detail: "FSL report confirms ammonium nitrate grade suitable for IEDs.", action: "File supplementary chargesheet with FSL findings" },
        { date: daysAgo(50), detail: "Supplementary chargesheet filed. Court listed for framing of charges.", action: "Attend charge framing hearing" },
      ],
    },
    {
      uid: uid("CNI", 6),
      psLimit: "Commissioner's Office, Chennai",
      crimeNumber: "CR-CNI-2024-0655",
      sectionOfLaw: "UAPA Sec 17, 40 — Raising Funds for Terrorist Act",
      dateOfOccurrence: daysAgo(400),
      dateOfRegistration: daysAgo(395),
      complainantName: "S. Lakshmi Narayanan",
      accusedDetails: "Abdul Kader and 3 others. Operating fake charity fronts to channel funds to proscribed organisations.",
      gist: "Investigation into a network of shell NGOs collecting donations under the guise of educational charity, funnelling ₹2.3 crore to proscribed organisations through hawala channels. Evidence gathered from FCRA records and bank statements.",
      stageId: stage("SC").id,
      assignedOfficerId: user("ADSP CNI").id,
      branchId: branch("CNI").id,
      createdById: user("SP ATS CNI").id,
      createdAt: daysAgo(395),
      actions: [
        "File response to SLP in Supreme Court",
        "Coordinate with Enforcement Directorate",
      ],
      progress: [
        { date: daysAgo(350), detail: "Trial court convicted 2 out of 4 accused. Sentenced to 7 years RI.", action: "Prepare appeal against acquittal of remaining accused" },
        { date: daysAgo(280), detail: "High Court upheld conviction. Accused filed SLP in Supreme Court.", action: "Engage Additional Solicitor General for SC hearing" },
        { date: daysAgo(45), detail: "Supreme Court notice issued. Matter listed for hearing.", action: "File counter-affidavit within 4 weeks" },
      ],
    },

    // ── MADURAI (5 cases) ─────────────────────────
    {
      uid: uid("MDU", 1),
      psLimit: "ATS Office, Madurai",
      crimeNumber: "CR-MDU-2025-0034",
      sectionOfLaw: "IPC 153A, 153B — Promoting Enmity Between Groups",
      dateOfOccurrence: daysAgo(120),
      dateOfRegistration: daysAgo(118),
      complainantName: "P. Murugesan",
      accusedDetails: "Kamaluddin, age 40, religious preacher from Dindigul. Delivered inflammatory speeches inciting communal violence.",
      gist: "Series of inflammatory speeches at religious gatherings in 5 districts recorded and circulated on social media, leading to communal tension. Accused called for violence against minority communities. Video evidence from 8 gatherings preserved.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS1MDU").id,
      branchId: branch("MDU").id,
      createdById: user("SP ATS MDU").id,
      createdAt: daysAgo(118),
      actions: [
        "Obtain certified video analysis from FSL",
        "Record statements of attendees from each gathering",
        "Coordinate with social media platforms for content removal",
      ],
      progress: [
        { date: daysAgo(100), detail: "Video transcripts and translations prepared. Sent to FSL for voice authentication.", action: "File application for custody of accused for further investigation" },
        { date: daysAgo(40), detail: "FSL confirmed voice match. 12 witness statements recorded.", action: "Prepare chargesheet draft" },
      ],
    },
    {
      uid: uid("MDU", 2),
      psLimit: "SP Office, Madurai",
      crimeNumber: "CR-MDU-2025-0067",
      sectionOfLaw: "Arms Act Sec 25, 27; IPC 120B — Criminal Conspiracy",
      dateOfOccurrence: daysAgo(180),
      dateOfRegistration: daysAgo(175),
      complainantName: "T. Saravanan",
      accusedDetails: "Veeramani and Karthik, ages 35 and 28. Illegal arms trafficking from neighbouring state. Seized 3 pistols, 1 rifle, and 200 rounds of ammunition.",
      gist: "Interstate arms trafficking network busted. Suspects transporting illegal weapons from Andhra Pradesh to Tamil Nadu for supply to criminal gangs. Arrested at Madurai bypass toll with concealed weapons in a modified vehicle.",
      stageId: stage("PT").id,
      assignedOfficerId: user("INS2MDU").id,
      branchId: branch("MDU").id,
      createdById: user("SP ATS MDU").id,
      createdAt: daysAgo(175),
      actions: [
        "Obtain ballistic report from FSL",
        "Trace weapon source through serial numbers",
      ],
      progress: [
        { date: daysAgo(160), detail: "Chargesheet filed. Accused remanded. Vehicle confiscated.", action: "Follow up with AP Police for supplier details" },
        { date: daysAgo(80), detail: "Ballistic report received. Weapons linked to 2 other cases.", action: "File supplementary report linking cases" },
      ],
    },
    {
      uid: uid("MDU", 3),
      psLimit: "ATS Office, Madurai",
      crimeNumber: "CR-MDU-2024-0312",
      sectionOfLaw: "UAPA Sec 18, 38, 39 — Membership of Terrorist Organisation",
      dateOfOccurrence: daysAgo(300),
      dateOfRegistration: daysAgo(295),
      complainantName: "R. Kannan",
      accusedDetails: "Jahangir Basha, age 32. Active member of a proscribed organisation, conducting secret recruitment camps in rural Madurai.",
      gist: "Long-term surveillance operation revealed accused conducting secret recruitment and ideological training camps in remote farmlands. Literature, training manuals, and recruitment records seized from rented property.",
      stageId: stage("HC").id,
      assignedOfficerId: user("DSP MDU").id,
      branchId: branch("MDU").id,
      createdById: user("SP ATS MDU").id,
      createdAt: daysAgo(295),
      actions: [
        "Oppose bail in High Court",
        "Submit additional evidence collated from seized documents",
      ],
      progress: [
        { date: daysAgo(260), detail: "Chargesheet filed with annexures running to 2,500 pages.", action: "Secure digital evidence certificate under Sec 65B" },
        { date: daysAgo(150), detail: "Sessions Court rejected bail. Accused moved HC.", action: "File detailed counter-affidavit in HC" },
        { date: daysAgo(30), detail: "HC reserved orders on bail application.", action: "Await orders; prepare for any eventuality" },
      ],
    },
    {
      uid: uid("MDU", 4),
      psLimit: "ATS Office, Madurai",
      crimeNumber: "CR-MDU-2025-0145",
      sectionOfLaw: "IPC 489A, 489B, 489C — Counterfeit Currency",
      dateOfOccurrence: daysAgo(75),
      dateOfRegistration: daysAgo(72),
      complainantName: "N. Balasubramanian",
      accusedDetails: "Riyaz Ahmed and Suresh Kumar, ages 38 and 42. Operating a FICN (Fake Indian Currency Notes) printing unit.",
      gist: "ATS raid on a printing press in Sivaganga district uncovered a sophisticated FICN operation producing ₹500 and ₹2000 denomination notes. Fake notes worth ₹25 lakh seized along with printing plates, special ink, and security thread paper.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS3MDU").id,
      branchId: branch("MDU").id,
      createdById: user("SP ATS MDU").id,
      createdAt: daysAgo(72),
      actions: [
        "Send samples to RBI for authentication analysis",
        "Trace paper and ink supply chain",
        "Identify distribution network",
      ],
      progress: [
        { date: daysAgo(55), detail: "RBI confirmed notes are high-quality counterfeits. Report received.", action: "Interrogate accused about distribution network" },
      ],
    },
    {
      uid: uid("MDU", 5),
      psLimit: "Cyber Cell, Madurai",
      crimeNumber: "CR-MDU-2025-0189",
      sectionOfLaw: "IT Act Sec 66, 66F; IPC 505 — Online Radicalisation",
      dateOfOccurrence: daysAgo(45),
      dateOfRegistration: daysAgo(42),
      complainantName: "K. Senthil Kumar",
      accusedDetails: "Arun Prasad, age 21, college student from Virudhunagar. Created and shared AI-generated propaganda videos promoting violent extremism.",
      gist: "College student using AI tools to create realistic propaganda videos depicting attacks on landmarks, shared across multiple platforms reaching 50,000+ views. Content designed to inspire lone-wolf attacks. Devices seized under cyber terrorism provisions.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS4MDU").id,
      branchId: branch("MDU").id,
      createdById: user("SP ATS MDU").id,
      createdAt: daysAgo(42),
      actions: [
        "Complete device forensics",
        "Map online following and identify influencees",
        "Coordinate with platforms for content takedown",
      ],
      progress: [
        { date: daysAgo(30), detail: "3 devices sent to C-DAC for forensic imaging and analysis.", action: "File for extension of judicial custody" },
      ],
    },

    // ── COIMBATORE (4 cases) ──────────────────────
    {
      uid: uid("CMB", 1),
      psLimit: "ATS Office, Coimbatore",
      crimeNumber: "CR-CMB-2025-0023",
      sectionOfLaw: "UAPA Sec 16, 18; Explosive Substances Act",
      dateOfOccurrence: daysAgo(160),
      dateOfRegistration: daysAgo(158),
      complainantName: "L. Gopalakrishnan",
      accusedDetails: "Jameela Banu and Naseer Ahmed, ages 30 and 35. Attempted car bombing near Coimbatore railway station.",
      gist: "Intelligence input led to interception of a vehicle near Coimbatore junction loaded with 10 kg of IED material. Both suspects apprehended. Vehicle modified with hidden compartment. Investigation revealed links to a cross-border terror module.",
      stageId: stage("PT").id,
      assignedOfficerId: user("INS1CMB").id,
      branchId: branch("CMB").id,
      createdById: user("SP ATS CMB").id,
      createdAt: daysAgo(158),
      actions: [
        "File additional chargesheet with FSL report",
        "Pursue Red Corner Notice for absconding handler",
      ],
      progress: [
        { date: daysAgo(140), detail: "Chargesheet filed under UAPA. NIA notified for coordination.", action: "Follow up on Interpol notice request" },
        { date: daysAgo(70), detail: "FSL confirmed composition of explosive — military grade. Report filed.", action: "Prepare for trial commencement" },
        { date: daysAgo(20), detail: "Trial commenced. Prosecution opened arguments. First witness examined.", action: "Ensure witness protection measures in place" },
      ],
    },
    {
      uid: uid("CMB", 2),
      psLimit: "SP Office, Coimbatore",
      crimeNumber: "CR-CMB-2025-0056",
      sectionOfLaw: "IPC 120B, 124A — Sedition & Criminal Conspiracy",
      dateOfOccurrence: daysAgo(110),
      dateOfRegistration: daysAgo(108),
      complainantName: "B. Sundaresan",
      accusedDetails: "5 members of a radical student group. Conspired to disrupt Republic Day celebrations and planned attack on parade route.",
      gist: "Intelligence agencies intercepted communications of a 5-member cell planning disruption of Republic Day parade in Coimbatore. Seized pamphlets, route maps of the parade, and communication intercepts. All 5 arrested from a rented apartment.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS2CMB").id,
      branchId: branch("CMB").id,
      createdById: user("SP ATS CMB").id,
      createdAt: daysAgo(108),
      actions: [
        "Complete interrogation of all 5 accused",
        "Analyse communication intercepts",
        "Identify funding sources",
      ],
      progress: [
        { date: daysAgo(90), detail: "All accused interrogated. Conspiracy plan documented in detail.", action: "Seek extension for investigation period" },
        { date: daysAgo(35), detail: "Call records analysis complete. 3 suspicious contacts in Kerala identified.", action: "Coordinate with Kerala ATS for suspect verification" },
      ],
    },
    {
      uid: uid("CMB", 3),
      psLimit: "Cyber Cell, Coimbatore",
      crimeNumber: "CR-CMB-2024-0467",
      sectionOfLaw: "IT Act Sec 66F; IPC 121 — Cyber Terror Attack",
      dateOfOccurrence: daysAgo(280),
      dateOfRegistration: daysAgo(275),
      complainantName: "S. Arthi",
      accusedDetails: "Unknown hacker group 'DigitalCaliphate'. Attempted SCADA system breach of power grid infrastructure.",
      gist: "Sophisticated cyber attack attempted on Tamil Nadu power grid SCADA systems. Attack was intercepted by CERT-In alerts. Digital forensics traced attack vectors to IP addresses in 3 countries. Investigation ongoing with international cooperation.",
      stageId: stage("UI").id,
      assignedOfficerId: user("DSP CMB").id,
      branchId: branch("CMB").id,
      createdById: user("SP ATS CMB").id,
      createdAt: daysAgo(275),
      actions: [
        "Coordinate with CERT-In and international agencies",
        "Engage cyber forensic experts for SCADA analysis",
        "File Mutual Legal Assistance requests",
      ],
      progress: [
        { date: daysAgo(250), detail: "CERT-In report received confirming attack sophistication level. 47 IP addresses identified.", action: "Send MLAT requests to USA, Turkey, and Malaysia" },
        { date: daysAgo(160), detail: "Response from FBI — 2 IP addresses linked to known threat actor group.", action: "Prepare detailed technical dossier for prosecution" },
        { date: daysAgo(60), detail: "Malaysian authorities arrested 1 suspect linked to the IP cluster.", action: "File extradition request through MEA" },
      ],
    },
    {
      uid: uid("CMB", 4),
      psLimit: "ATS Office, Coimbatore",
      crimeNumber: "CR-CMB-2025-0189",
      sectionOfLaw: "NIA Act; UAPA Sec 15 — Terrorist Act",
      dateOfOccurrence: daysAgo(30),
      dateOfRegistration: daysAgo(28),
      complainantName: "D. Palani",
      accusedDetails: "Zakir Hussain, age 29, from Tirupur. Received training at a foreign terror camp and returned to India on forged passport.",
      gist: "Suspect returned from foreign terror training camp on forged travel documents. Intercepted at Coimbatore airport based on Interpol alert. Possessed encrypted communication equipment and coded documents in luggage.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INS3CMB").id,
      branchId: branch("CMB").id,
      createdById: user("SP ATS CMB").id,
      createdAt: daysAgo(28),
      actions: [
        "Decode encrypted communications",
        "Verify travel history through passport authorities",
        "Coordinate with IB and RAW for intelligence inputs",
      ],
      progress: [
        { date: daysAgo(20), detail: "Forged passport confirmed by Regional Passport Office. Travel to Syria via Turkey traced.", action: "Seek 30-day police custody extension" },
      ],
    },

    // ── HEADQUARTERS (3 cases) ────────────────────
    {
      uid: uid("HQ", 1),
      psLimit: "DIG ATS Office, HQ",
      crimeNumber: "CR-HQ-2025-0005",
      sectionOfLaw: "UAPA Sec 17, 40; PMLA — Terror Financing",
      dateOfOccurrence: daysAgo(220),
      dateOfRegistration: daysAgo(215),
      complainantName: "ATS Intelligence Wing",
      accusedDetails: "Multi-state network of 8 accused. Operating through shell companies and cryptocurrency wallets to fund terror activities across South India.",
      gist: "Pan-India terror financing investigation coordinated by ATS HQ. ₹8.7 crore routed through 23 shell companies and converted to cryptocurrency. Funds traced to procurement of arms and explosives in 4 states. Joint operation with ED and NIA.",
      stageId: stage("PT").id,
      assignedOfficerId: user("ADSP HQ").id,
      branchId: branch("HQ").id,
      createdById: user("SP ATS HQ").id,
      createdAt: daysAgo(215),
      actions: [
        "Coordinate with ED for PMLA prosecution",
        "File chargesheet supplement with crypto wallet analysis",
        "Liaise with NIA for consolidated trial",
      ],
      progress: [
        { date: daysAgo(190), detail: "Chargesheet filed against 6 out of 8 accused. 2 absconding.", action: "Issue LOC for absconding accused" },
        { date: daysAgo(120), detail: "Cryptocurrency wallets frozen worth ₹3.2 crore with ED assistance.", action: "File supplementary chargesheet" },
        { date: daysAgo(25), detail: "1 absconding accused arrested from Mumbai. Produced before court.", action: "Seek transit remand and custodial interrogation" },
      ],
    },
    {
      uid: uid("HQ", 2),
      psLimit: "DIG ATS Office, HQ",
      crimeNumber: "CR-HQ-2024-0002",
      sectionOfLaw: "IPC 121, 121A; UAPA Sec 16, 18 — Conspiracy against State",
      dateOfOccurrence: daysAgo(500),
      dateOfRegistration: daysAgo(495),
      complainantName: "State Intelligence Department",
      accusedDetails: "Sleeper cell of 6 operatives. Deep-cover agents established across major cities of Tamil Nadu over a period of 5 years.",
      gist: "Major sleeper cell dismantled after 2-year intelligence operation. 6 operatives living under assumed identities across Chennai, Coimbatore, and Madurai. Planned coordinated attacks on multiple temples during festival season. Extensive documentary and digital evidence recovered.",
      stageId: stage("SC").id,
      assignedOfficerId: user("ADSP HQ").id,
      branchId: branch("HQ").id,
      createdById: user("DIG ATS").id,
      createdAt: daysAgo(495),
      actions: [
        "File response to SLP in Supreme Court",
        "Coordinate with AG office for SC hearing",
      ],
      progress: [
        { date: daysAgo(400), detail: "Trial completed. All 6 convicted by Special Court. Life imprisonment awarded.", action: "Prepare for anticipated appeal" },
        { date: daysAgo(300), detail: "High Court upheld conviction. 2 accused filed SLP in Supreme Court.", action: "Brief ASG for SC proceedings" },
        { date: daysAgo(15), detail: "Supreme Court issued notice. Hearing scheduled next month.", action: "File counter-affidavit and compile prison records" },
      ],
    },
    {
      uid: uid("HQ", 3),
      psLimit: "DIG ATS Office, HQ",
      crimeNumber: "CR-HQ-2025-0011",
      sectionOfLaw: "Official Secrets Act; IPC 120B, 121",
      dateOfOccurrence: daysAgo(60),
      dateOfRegistration: daysAgo(55),
      complainantName: "Defence Intelligence Agency (via MHA)",
      accusedDetails: "Rajesh Sharma, age 45, ex-defence contractor from Chennai. Suspected of passing classified defence documents to hostile intelligence agency.",
      gist: "Former defence contractor suspected of espionage. Classified documents relating to naval installations found during search. Encrypted USB drives and communication with foreign handlers discovered. Case referred to ATS by MHA for investigation under OSA.",
      stageId: stage("UI").id,
      assignedOfficerId: user("INSADMIN").id,
      branchId: branch("HQ").id,
      createdById: user("DIG ATS").id,
      createdAt: daysAgo(55),
      actions: [
        "Complete forensic examination of encrypted USB drives",
        "Coordinate with Defence Intelligence for document classification",
        "Seek sanction for prosecution under Official Secrets Act",
      ],
      progress: [
        { date: daysAgo(40), detail: "USB drives decrypted — 47 classified documents recovered. MHA notified.", action: "File for non-bailable warrant for 2 associates" },
        { date: daysAgo(10), detail: "2 associates arrested from Bangalore. Electronic devices seized.", action: "Seek police custody and begin interrogation" },
      ],
    },
  ];

  let caseCount = 0;
  let actionCount = 0;
  let progressCount = 0;

  for (const c of cases) {
    // Check if case with same UID or crimeNumber+branch already exists
    const existing = await prisma.case.findFirst({
      where: {
        OR: [
          { uid: c.uid },
          { crimeNumber: c.crimeNumber, branchId: c.branchId },
        ],
      },
    });

    if (existing) {
      console.log(`  ⏭ Skipping existing case: ${c.uid}`);
      continue;
    }

    const created = await prisma.case.create({
      data: {
        uid: c.uid,
        psLimit: c.psLimit,
        crimeNumber: c.crimeNumber,
        sectionOfLaw: c.sectionOfLaw,
        dateOfOccurrence: c.dateOfOccurrence,
        dateOfRegistration: c.dateOfRegistration,
        complainantName: c.complainantName,
        accusedDetails: c.accusedDetails,
        gist: c.gist,
        stageId: c.stageId,
        assignedOfficerId: c.assignedOfficerId,
        branchId: c.branchId,
        createdById: c.createdById,
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
      },
    });

    caseCount++;
    console.log(`  ✓ Case: ${created.uid} — ${c.sectionOfLaw.split("—")[0].trim()}`);

    // Create actions
    for (const actionDesc of c.actions) {
      await prisma.caseAction.create({
        data: {
          caseId: created.id,
          description: actionDesc,
          isCompleted: crypto.randomInt(100) > 60,   // ~40% completed randomly
          createdById: c.createdById,
          createdAt: c.createdAt,
        },
      });
      actionCount++;
    }

    // Create progress entries
    for (const p of c.progress) {
      await prisma.caseProgress.create({
        data: {
          caseId: created.id,
          progressDate: p.date,
          progressDetails: p.detail,
          furtherAction: p.action,
          createdById: c.assignedOfficerId,
          createdAt: p.date,
        },
      });
      progressCount++;
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   ${caseCount} cases created`);
  console.log(`   ${actionCount} actions created`);
  console.log(`   ${progressCount} progress entries created`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
