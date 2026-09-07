export function MakeMessage(message: string, ...args: Array<string | number | mod.Player>): mod.Message {
    const values = args.slice(0, 3);
    switch (values.length) {
        case 0:
            return mod.Message(message);
        case 1:
            return mod.Message(message, values[0]);
        case 2:
            return mod.Message(message, values[0], values[1]);
        default:
            return mod.Message(message, values[0], values[1], values[2]);
    }
}
