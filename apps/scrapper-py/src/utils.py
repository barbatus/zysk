from botasaurus.browser import cdp
from botasaurus_driver.core.tab import Tab
import typing


def mouse_press_and_hold(
    tab: Tab,
    x: int,
    y: int,
    *,
    button: str = "left",
    buttons: typing.Optional[int] = 1,
    modifiers: typing.Optional[int] = 0,
    hold_time: typing.Optional[int] = 10,
):

    tab.send(
        cdp.input_.dispatch_mouse_event(
            "mousePressed",
            x=x,
            y=y,
            modifiers=modifiers,
            button=cdp.input_.MouseButton(button),
            buttons=buttons,
            click_count=1,
        )
    )
    tab.sleep(hold_time)
    tab.send(
        cdp.input_.dispatch_mouse_event(
            "mouseReleased",
            x=x,
            y=y,
            modifiers=modifiers,
            button=cdp.input_.MouseButton(button),
            buttons=buttons,
            click_count=1,
        )
    )
