export interface User {
  id: number;
  name: string;
  username?: string;
  email: string;
  isAdmin: boolean;
  active?: boolean;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface Author {
  id: number;
  name: string;
  nationality?: string | null;
  birthDate?: string | null;
}

export interface Book {
  id: number;
  title: string;
  isbn: string;
  year?: number | null;
  totalCopies: number;
  availableCopies: number;
  categoryId?: number | null;
  category?: Category | null;
  authors?: Author[];
}

export interface Reader {
  id: number;
  name: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
}

export type LoanStatus = 'ATIVO' | 'ATRASADO' | 'DEVOLVIDO';

export interface Loan {
  id: number;
  loanDate: string;
  dueDate: string;
  returnDate?: string | null;
  status: LoanStatus;
  fine?: number | string | null;
  bookId: number;
  readerId: number;
  userId?: number;
  book?: Book | null;
  reader?: Reader | null;
  user?: User | null;
}

export interface DashboardReport {
  totalBooks: number;
  activeLoans: number;
  overdueLoans: number;
  totalFines: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user?: User;
}
