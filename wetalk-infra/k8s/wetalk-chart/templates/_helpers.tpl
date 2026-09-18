{{/* 统一资源名：优先 fullnameOverride，否则使用 Release 名 */}}
{{- define "wetalk.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
