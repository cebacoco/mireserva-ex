export interface Beach {
  id: number;
  name: string;
  island: string;
  description: string;
  privacy_score: number;
  capacity: number;
  current_occupancy: number;
  amenities: string[];
  panga_available: boolean;
  panga_schedule: string;
  image_url: string;
  lat?: number;
  lng?: number;
}


export interface Activity {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: string;
  max_participants: number;
  equipment: string[];
  image_url: string;
  available: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  category: 'Seafood' | 'Tacos' | 'Drinks' | 'Desserts' | 'Mains';
  description: string;
  price: number;
  dietary_tags: string[];
  image_url: string;
  available: boolean;
}

export interface CartItem {
  id: string;
  type: 'activity' | 'food';
  name: string;
  price: number;
  quantity: number;
  date?: string;
  participants?: number;
  image_url?: string;
}

export interface AvailabilityData {
  beaches: Record<string, string>;
  boats: Record<string, string>;
  activities: Record<string, string>;
  reservations: Record<string, string>;
}

export interface Booking {
  activity_id?: number;
  beach_id?: number;
  booking_date: string;
  participants: number;
  total_price: number;
  guest_name: string;
  guest_email: string;
  notes?: string;
}
