CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  firstName TEXT,
  lastName TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  userId TEXT PRIMARY KEY,
  phone TEXT,
  phoneCode TEXT,
  country TEXT,
  bio TEXT,
  subjects TEXT,
  languages TEXT,
  learningGoal TEXT,
  experience TEXT,
  qualification TEXT,
  price TEXT,
  profilePicture TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  tutorId TEXT NOT NULL,
  tutorName TEXT,
  studentId TEXT NOT NULL,
  studentName TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  updatedAt TEXT,
  studentCountry TEXT,
  studentSubjects TEXT
);
