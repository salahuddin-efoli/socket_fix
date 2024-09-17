import { Box, Icon, Popover, ResourceList, TextField } from '@shopify/polaris';
import { ClockIcon } from '@shopify/polaris-icons';
import { useEffect, useRef, useState } from 'react';

/**
 * @param initialTime a time string with H:mm AM/PM format
 * @param label a string
 * @param onChange a callback function
 * 
 * @returns Returns a time string with H:mm AM/PM format
 */
export default function DrTimePicker({ currentValue="", initialTime="", associatedDate, label="Time", onChange=() => {} }) {
    const isInitialMount = useRef(true);
    
    const [timePopoverActive, setTimePopoverActive] = useState(false);

    const [selectedTime, setSelectedTime] = useState(initialTime || "");

    const generateTimeArray = () => {
        // Interval between each time slot in minutes
        const interval = 30;

        // Array to store generated times
        const times = [];

        // Extract the day of the month from the associatedDate
        const associatedDateDay = new Date(associatedDate || new Date().toString()).getDate();

        // Get the current day of the month
        const todayDay = new Date().getDate();

        // Determine the current hour based on the comparison of days
        const currentHour = associatedDateDay > todayDay ? 0 : new Date().getHours() + 1;

        // Loop through each hour of the day starting from the current hour
        for (let hour = currentHour; hour <= 23; hour++) {
            // Loop through each minute in intervals of 'interval'
            for (let minute = 0; minute < 60; minute += interval) {
                // Format hour in 12-hour format
                let formattedHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);

                // Format minute to always have two digits
                let formattedMinute = minute === 0 ? '00' : `${minute}`;

                // Determine if it's AM or PM based on the hour
                let amPm = hour < 12 ? 'AM' : 'PM';

                // Construct the time string and push it to the times array
                times.push(`${formattedHour}:${formattedMinute} ${amPm}`);
            }
        }
        return times;
    }
    const timeList = generateTimeArray();

    useEffect(() => {
        if (isInitialMount.current) {
        isInitialMount.current = false;
        }
        else if (selectedTime) {
            onChange(selectedTime);
        }
    }, [selectedTime]);

    useEffect(() => {
        setSelectedTime(currentValue);
    }, [currentValue]);

    const onTimeSelect = (v) => {
        setSelectedTime(v);
        setTimePopoverActive(false);
    };

    const toggleTimePopoverActive = () => setTimePopoverActive(v => !v);

    const timeActivator = (
        <TextField
            label={label}
            value={selectedTime}
            prefix={<Icon source={ClockIcon} />}
            onFocus={toggleTimePopoverActive}
            autoComplete="off"
        />
    );

    return (
        <Popover
            preferredPosition="above"
            active={timePopoverActive}
            activator={timeActivator}
            onClose={toggleTimePopoverActive}
        >
            <Box width='100%' minWidth='240px'>
                <ResourceList items={timeList} renderItem={time => (
                    <ResourceList.Item id={time} onClick={onTimeSelect}>{time}</ResourceList.Item>
                )} />
            </Box>
        </Popover>
    )
}