"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { redirect } from "next/navigation";

const sql = postgres(process.env.POSTGRES_PRISMA_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

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
