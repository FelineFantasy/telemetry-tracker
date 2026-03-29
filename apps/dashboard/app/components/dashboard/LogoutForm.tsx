import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/app/components/ui/Button";

export function LogoutForm() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" className="app-sidebar__logout">
        Sign out
      </Button>
    </form>
  );
}
