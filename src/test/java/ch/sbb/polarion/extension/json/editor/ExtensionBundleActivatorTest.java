package ch.sbb.polarion.extension.json.editor;

import ch.sbb.polarion.extension.generic.rest.model.Version;
import ch.sbb.polarion.extension.generic.util.ExtensionInfo;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class ExtensionBundleActivatorTest {

    @Test
    void testBundleActivator() {
        try (MockedStatic<ExtensionInfo> extensionInfoMockedStatic = mockStatic(ExtensionInfo.class)) {
            ExtensionInfo info = mock(ExtensionInfo.class);
            extensionInfoMockedStatic.when(ExtensionInfo::getInstance).thenReturn(info);
            when(info.getVersion()).thenReturn(Version.builder().bundleBuildTimestamp("2023-11-14 07:29").build());

            assertEquals("json-editor", new ExtensionBundleActivator().getExtensions().keySet().iterator().next());
        }
    }

}
