
import { CRMContact } from '../types';
import { MOCK_CONTACTS } from '../constants';

export const getContactByPhone = async (phone: string): Promise<CRMContact | null> => {
  // Faster lookup simulation
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_CONTACTS.find(c => c.phone === phone) || null;
};

export const updateContactNotes = async (id: string, notes: string): Promise<boolean> => {
  const contact = MOCK_CONTACTS.find(c => c.id === id);
  if (contact) {
    contact.notes = notes;
    return true;
  }
  return false;
};
