import { redirect } from "next/navigation";
import { currentUser } from "./auth";
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/pos/login");
  return user;
}
