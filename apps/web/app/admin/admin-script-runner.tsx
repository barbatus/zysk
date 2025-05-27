import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Textarea,
  Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { isErrorResponse } from "@ts-rest/core";
import ReactJson from "@uiw/react-json-view";
import { monokaiTheme } from "@uiw/react-json-view/monokai";
import type { AdminScript } from "@zysk/ts-rest";
import { keyBy, mapValues } from "lodash";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useExecuteAdminScript } from "#/api/admin";

const runScriptFormSchema = z.object({
  arguments: z.array(
    z.object({ name: z.string(), value: z.string().optional() }),
  ),
  options: z.record(z.string(), z.boolean()),
});

export type RunScriptFormValues = z.infer<typeof runScriptFormSchema>;

export function AdminScriptRunnerButton({ script }: { script: AdminScript }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Run
      </Button>

      <Modal
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
      >
        <ModalDialog
          size="lg"
          sx={{ display: "flex", flexDirection: "column", minWidth: 600 }}
        >
          <ScriptRunnerDialogContent script={script} setIsOpen={setIsOpen} />
        </ModalDialog>
      </Modal>
    </>
  );
}

export function ScriptRunnerDialogContent({
  script,
  setIsOpen,
}: {
  script: AdminScript;
  setIsOpen: (value: boolean) => void;
}) {
  const {
    data: executeResult,
    isPending: isSubmitting,
    error,
    mutateAsync: executeAdminScriptAsync,
  } = useExecuteAdminScript();

  const form = useForm<RunScriptFormValues>({
    resolver: zodResolver(runScriptFormSchema),
    defaultValues: {
      arguments: script.arguments.map((arg) => ({
        name: arg.name,
        value: undefined,
      })),
      options: mapValues(
        keyBy(script.options, (x) => x.name),
        () => false,
      ),
    },
  });

  const disableForm = isSubmitting || executeResult?.body.result !== undefined;

  const onSubmit = async (values: RunScriptFormValues) => {
    await executeAdminScriptAsync({
      body: {
        name: script.name,
        ...values,
      },
      params: { name: script.name },
    });
  };

  const { mode } = useColorScheme();
  const isDarkTheme = mode === "dark";

  return (
    <>
      <DialogTitle>Run script &quot;{script.name}&quot;</DialogTitle>
      <DialogContent>
        <Typography level="body-sm" sx={{ mb: 2 }}>
          {script.description}
        </Typography>

        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit(onSubmit)();
          }}
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <Typography level="title-md" sx={{ mb: 1 }}>
            Settings
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ overflowY: "auto", flex: 1, pr: 1 }}>
            <Stack spacing={2}>
              {script.arguments.map((arg, i) => (
                <Controller
                  key={arg.name}
                  name={`arguments.${i}.value`}
                  control={form.control}
                  render={({ field }) => (
                    <FormControl disabled={disableForm} orientation="vertical">
                      <FormLabel>
                        {arg.name.replaceAll("--textarea", "")}
                        <Typography level="body-xs" textColor="neutral.500">
                          {arg.description}
                        </Typography>
                      </FormLabel>

                      {arg.name.includes("--textarea") ? (
                        <Textarea
                          {...field}
                          minRows={2}
                          maxRows={10}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                          }}
                          sx={{ mt: 1 }}
                        />
                      ) : (
                        <Input
                          {...field}
                          type={
                            arg.name.toLowerCase().includes("token")
                              ? "password"
                              : undefined
                          }
                          onChange={(e) => {
                            field.onChange(e.target.value);
                          }}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </FormControl>
                  )}
                />
              ))}

              {script.options.map((opt) => (
                <Controller
                  key={opt.name}
                  name={`options.${opt.name}`}
                  control={form.control}
                  render={({ field }) => (
                    <FormControl
                      disabled={disableForm}
                      orientation="horizontal"
                      sx={{ alignItems: "center" }}
                    >
                      <Checkbox
                        size="sm"
                        checked={field.value}
                        onChange={(e) => {
                          field.onChange(e.target.checked);
                        }}
                        sx={{ mr: 1 }}
                      />

                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <FormLabel>{opt.name}</FormLabel>
                        <Typography level="body-xs" textColor="neutral.500">
                          {opt.description}
                        </Typography>
                      </Box>
                    </FormControl>
                  )}
                />
              ))}
            </Stack>

            <Typography level="title-md" sx={{ mt: 4, mb: 1 }}>
              Results
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {isSubmitting ? (
              <Typography
                level="body-md"
                textColor="primary.500"
                sx={{ mb: 2 }}
              >
                Running…
              </Typography>
            ) : null}
            {isErrorResponse(error) && error.status === 500 ? (
              <Typography level="body-md" color="danger" sx={{ mb: 2 }}>
                {error.body.error}
              </Typography>
            ) : null}

            {executeResult ? (
              <ReactJson
                value={executeResult.body}
                style={isDarkTheme ? monokaiTheme : undefined}
                enableClipboard={false}
              />
            ) : (
              !isSubmitting &&
              !error && (
                <Typography level="body-sm" textColor="neutral.500">
                  Run to see results
                </Typography>
              )
            )}
          </Box>

          <DialogActions sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={disableForm}>
              Run
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </>
  );
}
