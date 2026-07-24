package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.util.ExtensionInfo;
import ch.sbb.polarion.extension.generic.util.ScopeUtils;
import com.polarion.alm.projects.model.IUniqueObject;
import com.polarion.alm.shared.api.SharedContext;
import com.polarion.alm.shared.api.transaction.TransactionalExecutor;
import com.polarion.alm.shared.api.utils.html.HtmlFragmentBuilder;
import com.polarion.alm.tracker.model.IAttachmentBase;
import com.polarion.alm.tracker.model.IModule;
import com.polarion.alm.tracker.model.IWithAttachments;
import com.polarion.alm.tracker.model.IWorkItem;
import com.polarion.alm.ui.server.forms.extensions.IFormExtension;
import com.polarion.alm.ui.server.forms.extensions.IFormExtensionContext;
import com.polarion.core.util.logging.Logger;
import com.polarion.platform.persistence.model.IPObject;
import com.polarion.platform.persistence.model.IPObjectList;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@SuppressWarnings({"java:S1192"})
public class JsonEditorFormExtension implements IFormExtension {

    public static final String ID = "json-editor";
    private static final Logger logger = Logger.getLogger(JsonEditorFormExtension.class);
    private static final String BUNDLE_TIMESTAMP = ExtensionInfo.getInstance().getVersion().getBundleBuildTimestampDigitsOnly();
    private static final Pattern TEMPLATE_PLACEHOLDER = Pattern.compile("\\$\\{(\\w+)}");

    @Override
    @Nullable
    public String render(@NotNull IFormExtensionContext context) {
        boolean validateOnSave = Boolean.parseBoolean(context.attributes().getOrDefault("validateOnSave", "false"));
        return TransactionalExecutor.executeSafelyInReadOnlyTransaction(
                transaction -> renderEditor(transaction.context(), context.object().getOldApi(), validateOnSave));
    }

    @Override
    @Nullable
    public String getIcon(@NotNull IPObject object, @Nullable Map<String, String> attributes) {
        return null;
    }

    @Override
    @Nullable
    public String getLabel(@NotNull IPObject object, @Nullable Map<String, String> attributes) {
        return "JSON Editor";
    }

    @SuppressWarnings("rawtypes")
    public String renderEditor(@NotNull SharedContext context, @NotNull IPObject object, boolean validateOnSave) {
        HtmlFragmentBuilder builder = context.createHtmlFragmentBuilderFor().gwt();

        try {
            IModule module = object instanceof IModule moduleObject ? moduleObject : null;
            IWorkItem workItem = object instanceof IWorkItem workItemObject ? workItemObject : null;
            if (module != null || workItem != null) {
                if (object.isPersisted()) {
                    // The React panel bundle (json-editor-app) is imported by the fragment and mounts into a
                    // shadow root on the host div; the context + existing JSON attachments are passed on the
                    // host's data-* attributes. See webapp/json-editor/html/json-editor-panel.html.
                    Map<String, String> values = Map.of(
                            "bundle", BUNDLE_TIMESTAMP,
                            "projectId", escapeHtml(((IUniqueObject) object).getProjectId()),
                            "entityId", escapeHtml(module != null ? module.getModuleName() : workItem.getId()),
                            "spaceId", escapeHtml(module != null ? getSpace(module) : ""),
                            "validateOnSave", String.valueOf(validateOnSave),
                            "attachments", escapeHtml(createAttachmentsJson((IWithAttachments) object)));
                    builder.html(fillTemplate(ScopeUtils.getFileContent("webapp/json-editor/html/json-editor-panel.html"), values));
                } else {
                    builder.tag().div().append().text("JSON editor will be available after first save.");
                }
            }
        } catch (Exception e) {
            logger.error(e.getMessage(), e);

            builder.tag().div().append().tag().b().append().text("Unknown error - see server log for more information.");
        }

        builder.finished();
        return builder.toString();
    }

    private String getSpace(IModule module) {
        return module.getLocalId().getContainerId().getObjectName();
    }

    private String escapeHtml(@NotNull String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }

    private String fillTemplate(@NotNull String template, @NotNull Map<String, String> values) {
        Matcher matcher = TEMPLATE_PLACEHOLDER.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String replacement = values.getOrDefault(matcher.group(1), matcher.group());
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * Builds a JSON array of the object's `.json` attachments ({@code [{"id":"..","fileName":".."}]}) for
     * the React panel to read from the fragment's {@code data-attachments} attribute. The caller
     * HTML-escapes the returned string for the attribute; here we only JSON-escape the id / file name.
     */
    @SuppressWarnings("rawtypes")
    private String createAttachmentsJson(IWithAttachments object) {
        IPObjectList<?> attachments = object.getAttachments();
        Map<String, String> map = getJsonAttachmentNames(attachments);
        StringBuilder builder = new StringBuilder("[");
        boolean first = true;
        for (Map.Entry<String, String> entry : map.entrySet()) {
            if (!first) {
                builder.append(',');
            }
            first = false;
            builder.append("{\"id\":\"").append(jsonEscape(entry.getKey()))
                    .append("\",\"fileName\":\"").append(jsonEscape(entry.getValue())).append("\"}");
        }
        builder.append(']');
        return builder.toString();
    }

    private String jsonEscape(@NotNull String value) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '\\' -> builder.append("\\\\");
                case '"' -> builder.append("\\\"");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> {
                    if (c < 0x20) {
                        builder.append(String.format("\\u%04x", (int) c));
                    } else {
                        builder.append(c);
                    }
                }
            }
        }
        return builder.toString();
    }

    private Map<String, String> getJsonAttachmentNames(IPObjectList<?> attachments) {
        return attachments.stream()
                .filter(IAttachmentBase.class::isInstance)
                .map(IAttachmentBase.class::cast)
                .filter(x -> x.getFileName().endsWith(".json"))
                .collect(java.util.stream.Collectors.toMap(IAttachmentBase::getId, IAttachmentBase::getFileName, (a, b) -> a, java.util.LinkedHashMap::new));
    }

}
