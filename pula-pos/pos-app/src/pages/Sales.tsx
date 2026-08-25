import { useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { money, dateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Receipt } from "../components/Receipt";
import type { ReceiptData } from "../lib/receipt";

// Voiding a sale erases its effect on the books and restocks the items — a
// cashier who could void their own sales could ring one up, pocket the
// cash, then void it to cover the shortfall. So it's owner/admin/manager
// only, matching the backend's requireRole check on POST /sales/:id/void.
const CAN_VOID_ROLES = ["OWNER", "ADMIN", "MANAGER"];

const LAYBUY_PAYMENT_METHODS = ["CASH", "CARD", "MOBILE_MONEY", "ORANGE_MONEY", "MYZAKA", "SMEGA", "BANK_TRANSFER"];

interface Sale {
  id: string;
  saleNumber: string;
  total: string;
  amountPaid: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customer: { name: string } | null;
  cashier: { name: string };
  items: { id: string }[];
}

interface SaleDetail {
  saleNumber: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  changeDue: string;
  customer: { name: string } | null;
  cashier: { name: string };
  items: { quantity: string; unitPrice: string; product: { name: string; unit: string } }[];
}

interface LaybuyDetail {
  id: string;
  saleNumber: string;
  status: string;
  total: string;
  amountPaid: string;
  customer: { name: string } | null;
  laybuyPayments: { id: string; amount: string; paymentMethod: string; createdAt: string }[];
}

export function SalesPage() {
  const { business, user } = useAuth();
  const canVoid = !!user && CAN_VOID_ROLES.includes(user.role);
  const needsApproval = user?.role === "CASHIER";

  const [tab, setTab] = useState<"sales" | "laybuys">("sales");
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptSale, setReceiptSale] = useState<ReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Laybuy management modal — record payments, complete (hand over), or cancel.
  const [managingId, setManagingId] = useState<string | null>(null);
  const [laybuyDetail, setLaybuyDetail] = useState<LaybuyDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [laybuyPaymentMethod, setLaybuyPaymentMethod] = useState("CASH");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelApproverEmail, setCancelApproverEmail] = useState("");
  const [cancelApproverPassword, setCancelApproverPassword] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => { load(); }, []);
  function load() {
    api.get<Sale[]>("/sale
