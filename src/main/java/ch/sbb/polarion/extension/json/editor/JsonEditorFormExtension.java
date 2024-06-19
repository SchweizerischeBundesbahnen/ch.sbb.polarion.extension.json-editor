package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.util.ExtensionInfo;
import ch.sbb.polarion.extension.generic.util.ScopeUtils;
import com.polarion.alm.shared.api.SharedContext;
import com.polarion.alm.shared.api.transaction.TransactionalExecutor;
import com.polarion.alm.shared.api.utils.html.HtmlFragmentBuilder;
import com.polarion.alm.shared.api.utils.links.HtmlLinkFactory;
import com.polarion.alm.tracker.model.IAttachmentBase;
import com.polarion.alm.tracker.model.IWorkItem;
import com.polarion.alm.ui.server.forms.extensions.IFormExtension;
import com.polarion.alm.ui.server.forms.extensions.IFormExtensionContext;
import com.polarion.core.util.logging.Logger;
import com.polarion.platform.persistence.model.IPObject;
import com.polarion.platform.persistence.model.IPObjectList;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@SuppressWarnings({"java:S1192"})
public class JsonEditorFormExtension implements IFormExtension {

    public static final String ID = "json-editor";
    private static final Logger logger = Logger.getLogger(JsonEditorFormExtension.class);
    private static final String BUNDLE_TIMESTAMP = ExtensionInfo.getInstance().getVersion().getBundleBuildTimestampDigitsOnly();

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

    public String renderEditor(@NotNull SharedContext context, @NotNull IPObject object, boolean validateOnSave) {
        HtmlFragmentBuilder builder = context.createHtmlFragmentBuilderFor().gwt();

        try {
            if (object instanceof IWorkItem workItem) {
                if (workItem.isPersisted()) {

                    builder.html(ScopeUtils.getFileContent("webapp/json-editor/html/json-editor.html")
                            .formatted(BUNDLE_TIMESTAMP, workItem.getProjectId(), workItem.getId(), createSelectOptions(workItem), validateOnSave));

                    addScripts(builder);

                } else {
                    builder.tag().div().append().text("JSON editor will be available after Work Item created.");
                }
            }
        } catch (Exception e) {
            logger.error(e.getMessage(), e);

            builder.tag().div().append().tag().b().append().text("Unknown error - see server log for more information.");
        }

        builder.finished();
        return builder.toString();
    }

    private String createSelectOptions(IWorkItem workItem) {
        IPObjectList<?> attachments = workItem.getAttachments();
        Map<String, String> map = getJsonAttachmentNames(attachments);
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : map.entrySet()) {
            builder.append("<option value='%1$s'>%2$s</option>".formatted(entry.getKey(), entry.getValue()));
        }
        return builder.toString();
    }

    private Map<String, String> getJsonAttachmentNames(IPObjectList<?> attachments) {
        return attachments.stream()
                .filter(IAttachmentBase.class::isInstance)
                .map(IAttachmentBase.class::cast)
                .filter(x -> x.getFileName().endsWith(".json"))
                .collect(Collectors.toMap(IAttachmentBase::getId, IAttachmentBase::getFileName));
    }

    private void addScripts(HtmlFragmentBuilder builder) {
        String scriptType = "text/javascript";
        addScriptSource(builder, "module", "/polarion/json-editor/ui/js/hljs-editor.js?bundle=" + UUID.randomUUID());
        addScriptSource(builder, scriptType, "/polarion/json-editor/ui/js/json-editor.js?bundle=" + BUNDLE_TIMESTAMP);
        addScriptSource(builder, scriptType, "/polarion/json-editor/ui/js/validation/json2.js?bundle=" + BUNDLE_TIMESTAMP);
        addScriptSource(builder, scriptType, "/polarion/json-editor/ui/js/validation/json-lint.js?bundle=" + BUNDLE_TIMESTAMP);
        addScriptSource(builder, scriptType, "/polarion/json-editor/ui/generic/js/common.js?bundle=" + BUNDLE_TIMESTAMP);
    }

    private void addScriptSource(HtmlFragmentBuilder builder, String scriptType, String scriptUrl) {
        builder.tag().script().attributes()
                .type(scriptType)
                .src(HtmlLinkFactory.fromEncodedRelativeUrl(scriptUrl));
    }

}
