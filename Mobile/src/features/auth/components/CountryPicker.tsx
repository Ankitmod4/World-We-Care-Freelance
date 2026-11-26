import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { AppText, Button, ErrorView, LoadingView, TextField } from "@/ui";
import { useCountries } from "../hooks/use-auth";

interface Props {
  value: string;
  onChange: (countryId: string) => void;
  error?: string;
}

export function CountryPicker({ value, onChange, error }: Props) {
  const { colors, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const countries = useCountries();

  const selected = countries.data?.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = countries.data ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [countries.data, search]);

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">Country</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          minHeight: 48,
          justifyContent: "center",
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderRadius: radius.md,
          borderColor: error ? colors.danger : colors.borderStrong,
          backgroundColor: colors.surface,
        }}
      >
        <AppText tone={selected ? "default" : "subtle"}>
          {selected ? `${selected.emojiFlag ?? ""} ${selected.name}`.trim() : "Choose your country"}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground, padding: spacing.lg, gap: spacing.md }}>
          <TextField label="Search" value={search} onChangeText={setSearch} autoFocus />
          {countries.isPending ? (
            <LoadingView />
          ) : countries.isError ? (
            <ErrorView error={countries.error} onRetry={() => countries.refetch()} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.borderSoft }}
                >
                  <AppText tone={item.id === value ? "brand" : "default"}>
                    {`${item.emojiFlag ?? ""} ${item.name}`.trim()}
                  </AppText>
                </Pressable>
              )}
            />
          )}
          <Button title="Close" variant="secondary" onPress={() => setOpen(false)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
