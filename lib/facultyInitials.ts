/** Faculty initials, as used in the source timetable (data/Timetable_*.xlsx). */
export const FACULTY: Record<string, string> = {
  NM: "Dr. Nivedita Mandal",
  UDC: "Dr. Udit Chawla",
  SD: "Dr. Sujit Dutta",
  AKH: "Dr. Anik Kumar Hazra",
  SNG: "Prof. Sanhita Ghosh",
  PB: "Prof. Prarthana Banerjee",
  SC: "Prof. Shouvik Chattopadhyay",
  SM: "Dr. Swati Mukherjee",
  KKG: "Prof. Kaushik Kumar Ganguly",
  PC: "Dr. Pritha Chanda",
  DBS: "Prof. Debasree Saha",
  SRN: "Dr. Srividya Nadindla",
  CM: "Prof. Chirabrata Majumdar",
  SHD: "Prof. Sohini Dutta",
  WM: "Prof. Writaparna Mukherjee",
  AB: "Prof. Anupam Bhattacharya",
  DS: "Dr. Dipak Saha",
  PK: "Prof. Prasenjit Kundu",
  RB: "Dr. Rana Basu",
  SAG: "Prof. Saugata Ghosh",
  SBC: "Dr. Subrata Chattopadhyay",
  BM: "Dr. Bikash Chandra Mandal",
  DM: "Prof. Debjit Mukherjee",
  DD: "Prof. Diptiman Dasgupta",
  AG: "Prof. Abhijit Ganguly",
  GUEST: "Guest Faculty",
  NA: "Staff / NA",
};

/** Full name → faculty initials, for display (e.g. avatar badges). */
export const FACULTY_INITIALS_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(FACULTY).map(([initials, name]) => [name, initials]),
);
