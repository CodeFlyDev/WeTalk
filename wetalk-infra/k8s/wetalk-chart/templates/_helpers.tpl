{{/* 统一资源名：优先 fullnameOverride，否则使用 Release 名 */}}
{{- define "wetalk.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* 服务级资源名：fullname-<service>（gateway/core/ai）*/}}
{{- define "wetalk.svcname" -}}
{{- $root := index . 0 -}}
{{- $svc := index . 1 -}}
{{- printf "%s-%s" (include "wetalk.fullname" $root) $svc | trunc 63 | trimSuffix "-" -}}
{{- end -}}
