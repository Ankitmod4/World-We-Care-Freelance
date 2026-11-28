import { Redirect } from "expo-router";

/**
 * "/(auth)" has no screen of its own. On the web the auth gate can land here
 * (e.g. opening "/" while signed out), so send the user to the login screen.
 */
export default function AuthIndex() {
  return <Redirect href="/login" />;
}
