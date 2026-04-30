using { test.retry as db } from '../db/schema';

service TestService {
  entity Items as projection on db.Items;
}
