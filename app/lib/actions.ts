"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { redirect } from "next/navigation";

const sql = postgres(process.env.POSTGRES_PRISMA_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string({
    required_error: "IDが必要です",
    invalid_type_error: "IDは文字列である必要があります",
  }),
  customerId: z.string({
    required_error: "顧客IDが必要です",
    invalid_type_error: "顧客IDは文字列である必要があります",
  }),
  amount: z.coerce.number({
    required_error: "金額が必要です",
    invalid_type_error: "金額は数値である必要があります",
  }),
  status: z.enum(["pending", "paid"], {
    required_error: "ステータスが必要です",
    invalid_type_error: "ステータスは'pending'または'paid'である必要があります",
  }),
  date: z.string({
    required_error: "日付が必要です",
    invalid_type_error: "日付は文字列である必要があります",
  }),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;

  revalidatePath("/dashboard/invoices");
  //目的: 古いキャッシュを削除して、最新データを表示させる
  //タイミング: データベース更新の直後
  //効果: 次回ページアクセス時に最新データを取得
  //revalidatePathがないと：
  //データは保存されるが、古いキャッシュが表示される
  //ユーザーは新しいデータを見ることができない

  redirect("/dashboard/invoices");
  //目的: ユーザーを適切なページに移動させる
  //タイミング: revalidatePathの直後
  //効果: 関数が終了し、指定されたページに移動
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;

  await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
