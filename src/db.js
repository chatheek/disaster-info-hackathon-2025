import Dexie from 'dexie';

export const db = new Dexie('DisasterReliefDB');

db.version(1).stores({
  // Added 'userId' to the schema list
  pendingReports: '++id, userId, disasterType, comments, latitude, longitude, severity, imageBlob, timestamp' 
});