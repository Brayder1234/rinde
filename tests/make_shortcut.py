# Genera el atajo "Rinde Apple Pay" (sin firmar). Luego se firma con:
#   shortcuts sign --mode anyone -i /tmp/rinde-unsigned.shortcut -o "atajo/Rinde Apple Pay.shortcut"  (firma válida hasta oct-2027)
# Al pagar con Apple Pay (automatización Wallet), copia "RINDE|cantidad|comercio|tarjeta|fecha ISO" y avisa.
import plistlib, sys, uuid

OBJ = '￼'  # marcador de variable dentro de un texto de Atajos
TX = 'WFWalletTransactionContentItem'

def prop(name):
    return {'Type': 'ExtensionInput', 'Aggrandizements': [
        {'Type': 'WFCoercionVariableAggrandizement', 'CoercionItemClass': TX},
        {'Type': 'WFPropertyVariableAggrandizement', 'PropertyName': name}]}

def token_string(parts):
    """parts: lista de textos y variables (dict) → texto con variables de Atajos."""
    s, attachments = '', {}
    for p in parts:
        if isinstance(p, dict):
            attachments[f'{{{len(s)}, 1}}'] = p
            s += OBJ
        else:
            s += p
    return {'Value': {'string': s, 'attachmentsByRange': attachments}, 'WFSerializationType': 'WFTextTokenString'}

now_iso = {'Type': 'CurrentDate', 'Aggrandizements': [
    {'Type': 'WFDateFormatVariableAggrandizement', 'WFDateFormatStyle': 'ISO 8601', 'WFISO8601IncludeTime': True}]}
text_id = str(uuid.uuid4()).upper()

actions = [
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.gettext', 'WFWorkflowActionParameters': {
        'UUID': text_id,
        'WFTextActionText': token_string(['RINDE|', prop('Amount'), '|', prop('Merchant'), '|', prop('Card or Pass'), '|', now_iso])}},
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.setclipboard', 'WFWorkflowActionParameters': {
        'WFInput': {'Value': {'OutputUUID': text_id, 'Type': 'ActionOutput', 'OutputName': 'Texto'},
                    'WFSerializationType': 'WFTextTokenAttachment'}}},
    {'WFWorkflowActionIdentifier': 'is.workflow.actions.notification', 'WFWorkflowActionParameters': {
        'WFNotificationActionTitle': 'Rinde',
        'WFNotificationActionBody': token_string(['Pago de ', prop('Amount'), ' en ', prop('Merchant'), ' copiado. Abre Rinde y toca “Pegar pago”.']),
        'WFNotificationActionSound': False}},
]

workflow = {
    'WFWorkflowClientVersion': '4711',
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {'WFWorkflowIconStartColor': 431817727, 'WFWorkflowIconGlyphNumber': 59511},
    'WFWorkflowImportQuestions': [],
    'WFWorkflowTypes': [],
    'WFQuickActionSurfaces': [],
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowInputContentItemClasses': [TX, 'WFStringContentItem'],
    'WFWorkflowOutputContentItemClasses': [],
    'WFWorkflowHasOutputFallback': False,
    'WFWorkflowActions': actions,
}

out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/rinde-unsigned.shortcut'
with open(out, 'wb') as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)
print('ok', out)
